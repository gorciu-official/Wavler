import type {
    FunctionDeclaration,
    SimpleTypeNode,
    Statement,
    Expression,
    IfExpression,
    TypeNode,
    StructDeclaration,
    StructInstantiation,
    MemberAccess
} from "../definitions/ast-node.ts";

import { error, ErrorCode, warn, WarnCode } from "../logging.ts";

type LLVMType = string;

export class LLVMCodeGen {
    private fnRetType: SimpleTypeNode | null = null;
    private tmpId = 0;
    private locals = new Map<string, { ptr: string, ty: string }>(); // variable -> { alloca name, type }
    private strings = new Map<string, string>(); // content -> global name
    private functionSignatures = new Map<string, { params: TypeNode[], returnType: TypeNode }>();
    private structs = new Map<string, StructDeclaration>();
    private emit: string[] = [];

    constructor(private body: Statement[]) {
        this.gatherSignatures();
    }

    private gatherSignatures() {
        for (const stmt of this.body) {
            if (stmt.type === "FunctionDeclaration" || stmt.type === "ExternFunctionDeclaration") {
                this.functionSignatures.set(stmt.name, {
                    params: stmt.params.map(p => p.type),
                    returnType: stmt.returnType
                });
            } else if (stmt.type === "StructDeclaration") {
                this.structs.set(stmt.name, stmt);
            }
        }
    }

    private fresh(): string {
        return `%t${this.tmpId++}`;
    }

    private resetFnState() {
        this.tmpId = 0;
        this.locals.clear();
    }

    processStructDeclaration(stmt: StructDeclaration): string {
        const fields = stmt.fields.map(f => this.toLLVMType(f.type)).join(", ");
        return `%struct.${stmt.name} = type { ${fields} }`;
    }

    processFunction(fn: FunctionDeclaration): string {
        if (fn.returnType.kind !== "SimpleType") {
            error({
                code: ErrorCode.ILLEGAL_RETURN_TYPE,
                reason: "Only simple types supported for now"
            });
        }

        this.resetFnState();
        this.fnRetType = fn.returnType;

        const retType = this.toLLVMType(fn.returnType);
        const params = fn.params
            .map(p => `${this.toLLVMType(p.type)} %${p.name}`)
            .join(", ");

        let ir = `define ${retType} @${fn.name}(${params}) {\nentry:\n`;

        for (const p of fn.params) {
            const ptr = this.fresh();
            const ty = this.toLLVMType(p.type);
            ir += `    ${ptr} = alloca ${ty}\n`;
            ir += `    store ${ty} %${p.name}, ptr ${ptr}\n`;
            this.locals.set(p.name, { ptr, ty });
        }

        for (const stmt of fn.body) {
            const out = this.processStatement(stmt);
            if (out) ir += `    ${out}\n`;
        }

        if (retType === "void") {
            ir += `    ret void ; fallback\n`;
        } else {
            ir += `    ret ${retType} 0 ; fallback\n`;
        }

        ir += "}\n";
        return ir;
    }

    processStatement(stmt: Statement): string | null {
        switch (stmt.type) {
            case "StructDeclaration":
                return this.processStructDeclaration(stmt);

            case "FunctionDeclaration":
                return this.processFunction(stmt);

            case "ExternFunctionDeclaration": {
                const retType = this.toLLVMType(stmt.returnType);
                const params = stmt.params
                    .map((p) => this.toLLVMType(p.type))
                    .join(", ");
                return `declare ${retType} @${stmt.name}(${params})`;
            }

            case "ReturnStatement": {
                if (!stmt.argument) {
                    return "ret void";
                }
            
                const val = this.processExpression(stmt.argument);
            
                const code = this.emit.splice(0).join("\n    ");
                return `${code}\n    ret ${this.fnRetType?.name} ${val}`;
            } 

            case "ExpressionStatement": {
                // idk placeholder
                const val = this.processExpression(stmt.expression);
                this.emit.push(`; evaluated ${val}`);
                return this.emit.splice(0).join("\n    ");
            } 

            case "VariableDeclaration": {
                const v = stmt.variable;

                const ptr = this.fresh();
                const ty = this.toLLVMType(v.type);

                this.locals.set(v.name, { ptr, ty });

                const val = this.processExpression(v.value);
                const code = this.emit.splice(0).join("\n    ");

                return [
                    code,
                    `${ptr} = alloca ${ty}`,
                    `store ${ty} ${val}, ptr ${ptr}`
                ].filter(i => i.length > 0).join("\n    ");
            }

            case "WhileStatement": {
                const id = this.tmpId++;
                const condLabel = `while_cond_${id}`;
                const bodyLabel = `while_body_${id}`;
                const endLabel = `while_end_${id}`;

                let ir = `br label %${condLabel}\n`;

                ir += `\n${condLabel}:\n`;
                const condVal = this.processExpression(stmt.condition);
                const condCode = this.emit.splice(0).join("\n    ");
                if (condCode) ir += `    ${condCode}\n`;
                ir += `    br i1 ${condVal}, label %${bodyLabel}, label %${endLabel}\n`;

                ir += `\n${bodyLabel}:\n`;
                for (const s of stmt.body) {
                    const out = this.processStatement(s);
                    if (out) ir += `    ${out}\n`;
                }
                ir += `    br label %${condLabel}\n`;

                ir += `\n${endLabel}:\n`;
                return ir;
            }

            case "ForStatement": {
                const id = this.tmpId++;
                const condLabel = `for_cond_${id}`;
                const bodyLabel = `for_body_${id}`;
                const updateLabel = `for_update_${id}`;
                const endLabel = `for_end_${id}`;

                let ir = "";

                if (stmt.init) {
                    const initOut = this.processStatement(stmt.init);
                    if (initOut) ir += `${initOut}\n    `;
                }

                ir += `br label %${condLabel}\n`;

                ir += `\n${condLabel}:\n`;
                if (stmt.condition) {
                    const condVal = this.processExpression(stmt.condition);
                    const condCode = this.emit.splice(0).join("\n    ");
                    if (condCode) ir += `    ${condCode}\n`;
                    ir += `    br i1 ${condVal}, label %${bodyLabel}, label %${endLabel}\n`;
                } else {
                    ir += `    br i1 1, label %${bodyLabel}, label %${endLabel}\n`;
                }

                ir += `\n${bodyLabel}:\n`;
                for (const s of stmt.body) {
                    const out = this.processStatement(s);
                    if (out) ir += `    ${out}\n`;
                }
                ir += `    br label %${updateLabel}\n`;

                ir += `\n${updateLabel}:\n`;
                if (stmt.update) {
                    this.processExpression(stmt.update);
                    const updateCode = this.emit.splice(0).join("\n    ");
                    if (updateCode) ir += `    ${updateCode}\n`;
                }
                ir += `    br label %${condLabel}\n`;

                ir += `\n${endLabel}:\n`;
                return ir;
            }

            case "EmptyStatement":
                return null;

            default:
                warn({
                    code: WarnCode.STATEMENT_NOT_IMPLEMENTED,
                    reason: `Statement type "${stmt.type}" is not implemented in codegen. This statement will be skipped.`
                });
                return null;
        }
    }

    processExpression(expr: Expression): string {
        switch (expr.type) {
            case "IfExpression":
                return this.processIfExpression(expr);

            case "NumberLiteral":
                return expr.value.toString();

            case "StringLiteral": {
                const id = `@.str.${this.strings.size}`;
                this.strings.set(expr.value, id);
                return id;
            }
    
            case "Identifier": {
                if (expr.name === "true") return "1";
                if (expr.name === "false") return "0";

                const info = this.locals.get(expr.name);
                if (!info) return `%${expr.name}`;
    
                const tmp = this.fresh();
                this.emit.push(`${tmp} = load ${info.ty}, ptr ${info.ptr}`);
                return tmp;
            }

            case "CallExpression": {
                if (expr.callee.type !== "Identifier") {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: "Only direct function calls supported in codegen"
                    });
                }

                const sig = this.functionSignatures.get(expr.callee.name);
                if (!sig) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Function ${expr.callee.name} not found`
                    });
                }

                const args = expr.arguments.map((arg, i) => {
                    const val = this.processExpression(arg);
                    return `${this.toLLVMType(sig!.params[i])} ${val}`;
                }).join(", ");

                const retType = this.toLLVMType(sig!.returnType);
                if (retType === "void") {
                    this.emit.push(`call void @${expr.callee.name}(${args})`);
                    return "";
                } else {
                    const tmp = this.fresh();
                    this.emit.push(`${tmp} = call ${retType} @${expr.callee.name}(${args})`);
                    return tmp;
                }
            }

            case "BinaryExpression": {
                const l = this.processExpression(expr.left as Expression);
                const r = this.processExpression(expr.right as Expression);
    
                const tmp = this.fresh();
    
                switch (expr.operator) {
                    case "+":
                        this.emit.push(`${tmp} = add i64 ${l}, ${r}`);
                        return tmp;
                    case "-":
                        this.emit.push(`${tmp} = sub i64 ${l}, ${r}`);
                        return tmp;
                    case "*":
                        this.emit.push(`${tmp} = mul i64 ${l}, ${r}`);
                        return tmp;
                    case "/":
                        this.emit.push(`${tmp} = sdiv i64 ${l}, ${r}`);
                        return tmp;
    
                    case "<":
                        this.emit.push(`${tmp} = icmp slt i64 ${l}, ${r}`);
                        return tmp;
    
                    case ">":
                        this.emit.push(`${tmp} = icmp sgt i64 ${l}, ${r}`);
                        return tmp;

                    case "<<":
                        this.emit.push(`${tmp} = shl i64 ${l}, ${r}`);
                        return tmp;
                    
                    case ">>":
                        this.emit.push(`${tmp} = ashr i64 ${l}, ${r}`);
                        return tmp;

                }

                // deno lint is stupid there is no fallthrough 
            }   /* falls through */

            case "AssignmentExpression": {
                const info = this.locals.get(expr.left.name);
                if (!info) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Variable ${expr.left.name} not found in codegen`
                    });
                }

                const val = this.processExpression(expr.right);
                this.emit.push(`store ${info.ty} ${val}, ptr ${info.ptr}`);
                return val;
            }

            case "StructInstantiation": {
                const struct = this.structs.get(expr.structName)!;
                const structType = `%struct.${expr.structName}`;
                
                const ptr = this.fresh();
                this.emit.push(`${ptr} = alloca ${structType}`);
                
                for (const field of expr.fields) {
                    const fieldIdx = struct.fields.findIndex(f => f.name === field.name);
                    const structField = struct.fields[fieldIdx];
                    const val = this.processExpression(field.value);
                    const fieldPtr = this.fresh();
                    const fieldType = this.toLLVMType(structField.type);
                    
                    this.emit.push(`${fieldPtr} = getelementptr inbounds ${structType}, ptr ${ptr}, i32 0, i32 ${fieldIdx}`);
                    this.emit.push(`store ${fieldType} ${val}, ptr ${fieldPtr}`);
                }
                
                const res = this.fresh();
                this.emit.push(`${res} = load ${structType}, ptr ${ptr}`);
                return res;
            }

            case "MemberAccess": {
                if (expr.object.type === "Identifier") {
                    const info = this.locals.get(expr.object.name);
                    if (info && info.ty.startsWith("%struct.")) {
                        const structName = info.ty.replace("%struct.", "");
                        const struct = this.structs.get(structName)!;
                        const fieldIdx = struct.fields.findIndex(f => f.name === expr.member);
                        const field = struct.fields[fieldIdx];
                        const fieldType = this.toLLVMType(field.type);
                        
                        const fieldPtr = this.fresh();
                        this.emit.push(`${fieldPtr} = getelementptr inbounds ${info.ty}, ptr ${info.ptr}, i32 0, i32 ${fieldIdx}`);
                        
                        const res = this.fresh();
                        this.emit.push(`${res} = load ${fieldType}, ptr ${fieldPtr}`);
                        return res;
                    }
                }
                
                error({
                    code: ErrorCode.TYPE_MISMATCH,
                    reason: "Member access only implemented for variables for now"
                });
            }
        }
    } 

    private processIfExpression(expr: IfExpression): string {
        const id = this.tmpId++;
        const thenLabel = `if_then_${id}`;
        const elseLabel = `if_else_${id}`;
        const endLabel = `if_end_${id}`;

        const condVal = this.processExpression(expr.condition);
        const condCode = this.emit.splice(0).join("\n    ");
        
        let ir = "";
        if (condCode) ir += `${condCode}\n    `;
        ir += `br i1 ${condVal}, label %${thenLabel}, label %${elseLabel}\n`;

        ir += `\n${thenLabel}:\n`;
        for (const s of expr.thenBranch) {
            const out = this.processStatement(s);
            if (out) ir += `    ${out}\n`;
        }
        ir += `    br label %${endLabel}\n`;

        ir += `\n${elseLabel}:\n`;
        if (expr.elseBranch) {
            for (const s of expr.elseBranch) {
                const out = this.processStatement(s);
                if (out) ir += `    ${out}\n`;
            }
        }
        ir += `    br label %${endLabel}\n`;

        ir += `\n${endLabel}:\n`;

        this.emit.push(ir.trim());
        return "";
    }

    private toLLVMType(t: TypeNode): string {
        if (t.kind !== "SimpleType")
            error({
                code: ErrorCode.ILLEGAL_RETURN_TYPE,
                reason: "Only simple types supported"
            });
        switch (t.name) {
            case "i64": case "i32": case "i16":
            case "i8": case "f64": case "f32":
            case "void": case "u64": case "u32":
            case "u16": case "u8":
                return t.name;
            case "boolean":
                return "i1";
            case "string":
                return "ptr";
            default:
                if (this.structs.has(t.name)) {
                    return `%struct.${t.name}`;
                }

                error({
                    code: ErrorCode.ILLEGAL_RETURN_TYPE,
                    reason: `Type ${t.name} not implemented in codegen`
                });
        }
    }

    generate(): string {
        let bodyIr = "";
        for (const stmt of this.body) {
            const res = this.processStatement(stmt);
            if (res) bodyIr += res + "\n";
        }

        let out = 'target triple = "x86_64-pc-linux-gnu"\n\n';

        for (const [content, id] of this.strings) {
            const escaped = content.replace(/\n/g, "\\0A").replace(/"/g, '\\22');
            out += `${id} = private unnamed_addr constant [${content.length + 1} x i8] c"${escaped}\\00", align 1\n`;
        }
        
        if (this.strings.size > 0) out += "\n";

        out += bodyIr;

        return out;
    }
}
