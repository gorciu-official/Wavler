import type {
    Expression,
    ExternFunctionDeclaration,
    ForOfStatement,
    ForStatement,
    FunctionDeclaration,
    IfExpression,
    MemberAccess,
    ReturnStatement,
    Statement,
    StructDeclaration,
    StructInstantiation,
    TypeNode,
    VariableDeclaration,
    WhileStatement,
} from "../definitions/ast-node.ts";
import type { Symbol } from "../definitions/symbol.ts";
import { error, ErrorCode } from "../logging.ts";

const allowed_types: string[] = [
    'i64', 'i32', 'i16', 'i8',
    'u64', 'u32', 'u16', 'u8',
    'string', 'void', 'f64', 'f32', 'boolean'
];
const typescript_types: string[] = [
    'number', 'object'
];

class Scope {
    private symbols = new Map<string, Symbol>();

    constructor(public parent: Scope | null = null) {}

    declare(sym: Symbol) {
        if (allowed_types.includes(sym.name)) 
            error({
                code: ErrorCode.ILLEGAL_IDENTIFIER,
                reason: `Symbol name ${sym.name} cannot be a symbol because it refers to a type.`
            });
        this.symbols.set(sym.name, sym);
    }

    resolve(name: string): Symbol | null {
        return this.symbols.get(name) ?? this.parent?.resolve(name) ?? null;
    }
}

export class SemanticAnalyzer {
    private global = new Scope(null);
    private current = this.global;
    private insideFunction = false;
    private structs = new Map<string, StructDeclaration>();

    analyze(program: Statement[]) {
        if (!this.global.resolve("true")) {
            this.global.declare({
                name: "true",
                mutable: false,
                type: { kind: "SimpleType", name: "boolean" },
            });
            this.global.declare({
                name: "false",
                mutable: false,
                type: { kind: "SimpleType", name: "boolean" },
            });
        }

        for (const stmt of program) {
            this.visitStatement(stmt);
        }
    }

    private pushScope() {
        this.current = new Scope(this.current);
    }

    private popScope() {
        if (this.current.parent) {
            this.current = this.current.parent;
        }
    }

    visitStatement(stmt: Statement): boolean {
        if (![ "EmptyStatement", "FunctionDeclaration", "ExternFunctionDeclaration", "StructDeclaration" ].includes(stmt.type) && !this.insideFunction)
            error({
                code: ErrorCode.STATEMENT_ILLEGAL_OUTSIDE_A_FUNCTION,
                reason: `Statement type "${stmt.type}" cannot be used outside a function`
            });

        switch (stmt.type) {
            case "FunctionDeclaration":
                return this.visitFunction(stmt);

            case "ExternFunctionDeclaration":
                return this.visitExternFunction(stmt);

            case "StructDeclaration":
                return this.visitStructDeclaration(stmt);

            case "VariableDeclaration":
                return this.visitVar(stmt);

            case "ExpressionStatement":
                if (stmt.expression.type === "IfExpression") {
                    return this.visitIfAsStatement(stmt.expression);
                }
                this.visitExpression(stmt.expression);
                return false;

            case "ReturnStatement":
                return this.visitReturn(stmt);

            case "WhileStatement":
                return this.visitWhile(stmt);

            case "ForStatement":
                return this.visitFor(stmt);

            case "ForOfStatement":
                return this.visitForOf(stmt);

            case "EmptyStatement":
                return false;

            default:
                throw new Error(
                    `Unhandled statement type: ${(stmt as Statement).type}`
                );
        }
    }

    visitWhile(stmt: WhileStatement): boolean {
        this.visitExpression(stmt.condition);

        this.pushScope();
        for (const s of stmt.body) {
            this.visitStatement(s);
        }
        this.popScope();

        return false;
    }

    visitIfExpression(expr: IfExpression): TypeNode | null {
        this.visitIfAsStatement(expr);
        return { kind: "SimpleType", name: "void" };
    }

    visitIfAsStatement(expr: IfExpression): boolean {
        this.visitExpression(expr.condition);

        let thenReturns = false;
        this.pushScope();
        for (const s of expr.thenBranch) {
            if (this.visitStatement(s)) thenReturns = true;
        }
        this.popScope();

        let elseReturns = false;
        if (expr.elseBranch) {
            this.pushScope();
            for (const s of expr.elseBranch) {
                if (this.visitStatement(s)) elseReturns = true;
            }
            this.popScope();
        } else {
            return false;
        }

        return thenReturns && elseReturns;
    }

    visitFor(stmt: ForStatement): boolean {
        this.pushScope();

        if (stmt.init) {
            if (stmt.init.type === "VariableDeclaration") {
                this.visitVar(stmt.init);
            } else {
                this.visitStatement(stmt.init);
            }
        }

        if (stmt.condition) {
            this.visitExpression(stmt.condition);
        }

        if (stmt.update) {
            this.visitExpression(stmt.update);
        }

        for (const s of stmt.body) {
            this.visitStatement(s);
        }

        this.popScope();

        return false;
    }

    visitForOf(stmt: ForOfStatement): boolean {
        this.pushScope();

        if (this.current.resolve(stmt.iterator.name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Variable ${stmt.iterator.name} already exists`
            });
        }

        this.visitExpression(stmt.iterable);

        this.current.declare({
            name: stmt.iterator.name,
            type: { kind: "SimpleType", name: "unknown" }, // TODO: infer
            mutable: !stmt.iterator.const,
        });

        for (const s of stmt.body) {
            this.visitStatement(s);
        }

        this.popScope();

        return false;
    }

    validateType(tp: TypeNode, i: number = 0) {
        if (i == 15)
            throw new Error("Type depth limit reached");

        if (tp.kind == "UnionType") {
            for (const subtype of tp.types)
                this.validateType(subtype, i + 1);
            return;
        }

        if (tp.kind == "FunctionType") {
            for (const param of tp.params)
                this.validateType(param, i + 1);
            this.validateType(tp.returnType, i + 1);
            return;
        }

        // SimpleType
        if (!allowed_types.includes(tp.name) && !this.structs.has(tp.name)) 
            error({
                code: ErrorCode.UNKNOWN_TYPE,
                reason: `Unknown type: ${tp.name}`,
                help: typescript_types.includes(tp.name)
                    ? `Type "${tp.name}" is one of TypeScript types which we do not implement. Please change your type to one of supported ones: ${allowed_types.join(',')}`
                    : undefined
            }) 
    }

    visitStructDeclaration(stmt: StructDeclaration): boolean {
        if (this.structs.has(stmt.name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Struct ${stmt.name} already exists`,
            });
        }

        for (const field of stmt.fields) {
            this.validateType(field.type);
        }

        this.structs.set(stmt.name, stmt);
        return false;
    }

    visitExternFunction(fn: ExternFunctionDeclaration): boolean {
        this.validateType(fn.returnType);

        if (this.current.resolve(fn.name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Function ${fn.name} already exists`,
            });
        }

        for (const p of fn.params) {
            this.validateType(p.type);
        }

        this.current.declare({
            name: fn.name,
            mutable: false,
            type: {
                kind: "FunctionType",
                params: fn.params.map((p) => p.type),
                returnType: fn.returnType,
            },
        });

        return false;
    }

    visitVar(stmt: VariableDeclaration) {
        const name = stmt.variable.name;

        if (this.current.resolve(name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Variable ${name} already exists`
            });
        }
        
        this.validateType(stmt.variable.type);

        const valueType = this.visitExpression(stmt.variable.value);

        this.current.declare({
            name,
            type: stmt.variable.type ?? valueType,
            mutable: !stmt.variable.const,
        });

        return false;
    }

    visitExpression(expr: Expression): TypeNode | null {
        switch (expr.type) {
            case "IfExpression":
                return this.visitIfExpression(expr);

            case "NumberLiteral":
                return { kind: "SimpleType", name: "i64" };

            case "StringLiteral":
                return { kind: "SimpleType", name: "string" };

            case "Identifier": {
                const sym = this.current.resolve(expr.name);

                if (!sym) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Variable ${expr.name} does not exist`
                    });
                }

                return sym!.type;
            }

            case "CallExpression": {
                const calleeType = this.visitExpression(expr.callee);

                if (calleeType?.kind !== "FunctionType") {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Callee is not a function`
                    });
                }

                if (expr.arguments.length !== calleeType!.params.length) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Expected ${calleeType!.params.length} arguments, got ${expr.arguments.length}`
                    });
                }

                for (let i = 0; i < expr.arguments.length; i++) {
                    const argType = this.visitExpression(expr.arguments[i]);
                    const paramType = calleeType!.params[i];

                    if (argType?.kind === "SimpleType" && paramType.kind === "SimpleType" && argType.name !== paramType.name) {
                        error({
                            code: ErrorCode.TYPE_MISMATCH,
                            reason: `Argument type mismatch: expected ${paramType.name}, got ${argType.name}`
                        });
                    }
                }

                return calleeType!.returnType;
            }

            case "BinaryExpression": {
                const left = this.visitExpression(expr.left as Expression);
                const right = this.visitExpression(expr.right as Expression);

                if (
                    left?.kind === "SimpleType" &&
                    right?.kind === "SimpleType" &&
                    left.name !== right.name
                ) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Type mismatch: ${left.name} ${expr.operator} ${right.name}`
                    });
                }

                if (["<", ">"].includes(expr.operator)) {
                    return { kind: "SimpleType", name: "boolean" };
                }

                return left;
            }

            case "AssignmentExpression": {
                const sym = this.current.resolve(expr.left.name);

                if (!sym) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Variable ${expr.left.name} does not exist`
                    });
                }

                if (!sym.mutable) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH, 
                        reason: `Cannot assign to const variable ${expr.left.name}`
                    });
                }

                const right = this.visitExpression(expr.right);

                if (
                    sym.type.kind === "SimpleType" &&
                    right?.kind === "SimpleType" &&
                    sym.type.name !== right.name
                ) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Type mismatch in assignment to ${expr.left.name}: expected ${sym.type.name}, got ${right.name}`
                    });
                }

                return sym.type;
            }

            case "MemberAccess": {
                const objType = this.visitExpression(expr.object);
                if (objType?.kind !== "SimpleType") {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: "Member access only allowed on simple types (structs)",
                    });
                }

                const struct = this.structs.get(objType!.name);
                if (!struct) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Type ${objType!.name} is not a struct`,
                    });
                }

                const field = struct!.fields.find((f) => f.name === expr.member);
                if (!field) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Field ${expr.member} does not exist in struct ${objType!.name}`,
                    });
                }

                return field!.type;
            }

            case "StructInstantiation": {
                const struct = this.structs.get(expr.structName);
                if (!struct) {
                    error({
                        code: ErrorCode.UNKNOWN_TYPE,
                        reason: `Unknown struct: ${expr.structName}`,
                    });
                }

                if (expr.fields.length !== struct!.fields.length) {
                    error({
                        code: ErrorCode.TYPE_MISMATCH,
                        reason: `Expected ${struct!.fields.length} fields, got ${expr.fields.length}`,
                    });
                }

                for (const field of expr.fields) {
                    const structField = struct!.fields.find((f) => f.name === field.name);
                    if (!structField) {
                        error({
                            code: ErrorCode.UNDEFINED_VARIABLE,
                            reason: `Field ${field.name} does not exist in struct ${expr.structName}`,
                        });
                    }

                    const valType = this.visitExpression(field.value);
                    if (
                        valType?.kind === "SimpleType" &&
                        structField!.type.kind === "SimpleType" &&
                        valType.name !== structField!.type.name
                    ) {
                        error({
                            code: ErrorCode.TYPE_MISMATCH,
                            reason: `Field ${field.name} type mismatch: expected ${structField!.type.name}, got ${valType.name}`,
                        });
                    }
                }

                return { kind: "SimpleType", name: expr.structName };
            }
        }
    }

    visitFunction(fn: FunctionDeclaration): boolean {
        this.validateType(fn.returnType);

        if (this.current.resolve(fn.name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Function ${fn.name} already exists`
            }); 
        }

        this.current.declare({
            name: fn.name,
            mutable: false,
            type: {
                kind: "FunctionType",
                params: fn.params.map((p) => p.type),
                returnType: fn.returnType,
            },
        });

        const prev = this.current;
        const prevFn = this.insideFunction;

        if (prevFn) {
            error({
                code: ErrorCode.ILLEGAL_FUNCTION_STATEMENT,
                reason: "Function statement inside a function is not allowed"
            });
        }

        this.current = new Scope(prev);
        this.insideFunction = true;

        for (const p of fn.params) {
            this.current.declare({
                name: p.name,
                type: p.type,
                mutable: false,
            });
        }

        let returns = false;

        for (const stmt of fn.body) {
            returns = this.visitStatement(stmt);
            if (returns) break;
        }

        if (fn.returnType.kind !== "SimpleType") 
            error({
                code: ErrorCode.ILLEGAL_RETURN_STATEMENT,
                reason: `Returning union/function type from functions is currently not allowed.`
            })

        if (fn.returnType.name !== "void" && !returns) {
            error({
                code: ErrorCode.MISSING_RETURN,
                reason: `Function "${fn.name}" does not return on all paths`
            });
        }

        this.current = prev;
        this.insideFunction = prevFn;

        return false;
    }

    visitReturn(stmt: ReturnStatement): boolean {
        if (!this.insideFunction) {
            error({
                code: ErrorCode.ILLEGAL_RETURN_STATEMENT,
                reason: "Illegal return statement"
            });
        }

        if (stmt.argument) {
            this.visitExpression(stmt.argument);
        }

        return true;
    }
}
