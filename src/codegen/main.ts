import type {
    FunctionDeclaration,
    SimpleTypeNode,
    Statement,
    Expression,
    TypeNode
} from "../definitions/ast-node.ts";

import { error, ErrorCode, warn, WarnCode } from "../logging.ts";

type LLVMType = "i64" | "i32" | "i16" | "i8" | "f64" | "f32" | "u64" | "u32" | "u16" | "u8" | "void";

export class LLVMCodeGen {
    private fnRetType: SimpleTypeNode | null = null;
    private tmpId = 0;
    private locals = new Map<string, string>(); // variable -> alloca name
    private emit: string[] = [];

    constructor(private body: Statement[]) {}

    private fresh(): string {
        return `%t${this.tmpId++}`;
    }

    private resetFnState() {
        this.tmpId = 0;
        this.locals.clear();
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
            ir += `    ${ptr} = alloca ${this.toLLVMType(p.type)}\n`;
            ir += `    store ${this.toLLVMType(p.type)} %${p.name}, ptr ${ptr}\n`;
            this.locals.set(p.name, ptr);
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
            case "FunctionDeclaration":
                return this.processFunction(stmt);

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

                this.locals.set(v.name, ptr);

                const val = this.processExpression(v.value);

                return [
                    `${ptr} = alloca ${ty}`,
                    `store ${ty} ${val}, ptr ${ptr}`
                ].join("\n    ");
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
            case "NumberLiteral":
                return expr.value.toString();
    
            case "Identifier": {
                const ptr = this.locals.get(expr.name);
                if (!ptr) return `%${expr.name}`;
    
                const tmp = this.fresh();
                this.emit.push(`${tmp} = load i64, ptr ${ptr}`);
                return tmp;
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
            }
        }
    } 

    private toLLVMType(t: TypeNode): LLVMType {
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
            default:
                error({
                    code: ErrorCode.ILLEGAL_RETURN_TYPE,
                    reason: `Type ${t.name} not implemented in codegen`
                });
        }
    }

    generate(): string {
        let out = 'target triple = "x86_64-pc-linux-gnu"\n\n';

        for (const stmt of this.body) {
            const res = this.processStatement(stmt);
            if (res) out += res + "\n";
        }

        return out;
    }
}
