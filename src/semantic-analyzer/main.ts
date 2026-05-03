import type { Expression, ForOfStatement, ForStatement, FunctionDeclaration, ReturnStatement, Statement, TypeNode, VariableDeclaration, WhileStatement } from "../definitions/ast-node.ts";
import type { Symbol } from "../definitions/symbol.ts";
import { error, ErrorCode } from "../logging.ts";

class Scope {
    private symbols = new Map<string, Symbol>();

    constructor(public parent: Scope | null = null) {}

    declare(sym: Symbol) {
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

    visitStatement(stmt: Statement) {
        switch (stmt.type) {
            case "FunctionDeclaration":
                return this.visitFunction(stmt);

            case "VariableDeclaration":
                return this.visitVar(stmt);

            case "ExpressionStatement":
                return this.visitExpression(stmt.expression);

            case "ReturnStatement":
                return this.visitReturn(stmt);

            case "WhileStatement":
                return this.visitWhile(stmt);

            case "ForStatement":
                return this.visitFor(stmt);

            case "ForOfStatement":
                return this.visitForOf(stmt);

            case "EmptyStatement":
                return;

            default:
                throw new Error(
                    `Unhandled statement type: ${(stmt as Statement).type}`
                );
        }
    }

    visitWhile(stmt: WhileStatement) {
        this.visitExpression(stmt.condition);

        this.pushScope();
        for (const s of stmt.body) {
            this.visitStatement(s);
        }
        this.popScope();
    }

    visitFor(stmt: ForStatement) {
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
    }

    visitForOf(stmt: ForOfStatement) {
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
    }

    validateType(tp: TypeNode, i: number = 0) {
        if (i == 15)
            throw new Error("Type depth limit reached");

        if (tp.kind == "UnionType") {
            for (const subtype of tp.types)
                this.validateType(subtype, i + 1);
            return;
        }

        // SimpleType 
        const allowed_types: string[] = [
            'i64', 'i32', 'i16', 'i8',
            'u64', 'u32', 'u16', 'u8',
            'string'
        ];
        const typescript_types: string[] = [
            'number', 'object'
        ];

        if (!allowed_types.includes(tp.name)) 
            error({
                code: ErrorCode.UNKNOWN_TYPE,
                reason: `Unknown type: ${tp.name}`,
                help: typescript_types.includes(tp.name)
                    ? `Type "${tp.name}" is one of TypeScript types which we do not implement. Please change your type to one of supported ones: ${allowed_types.join(',')}`
                    : undefined
            }) 
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
    }

    visitExpression(expr: Expression): TypeNode | null {
        switch (expr.type) {
            case "NumberLiteral":
                return { kind: "SimpleType", name: "i64" };

            case "Identifier": {
                const sym = this.current.resolve(expr.name);

                if (!sym) {
                    error({
                        code: ErrorCode.UNDEFINED_VARIABLE,
                        reason: `Variable ${expr.name} does not exist`
                    });
                }

                return sym.type;
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
        }
    }

    visitFunction(fn: FunctionDeclaration) {
        if (this.current.resolve(fn.name)) {
            error({
                code: ErrorCode.ALREADY_EXISTS,
                reason: `Function ${fn.name} already exists`
            }); 
        }

        this.current.declare({
            name: fn.name,
            mutable: false,
            type: { kind: "SimpleType", name: "function" },
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

        for (const stmt of fn.body) {
            this.visitStatement(stmt);
        }

        this.current = prev;
        this.insideFunction = prevFn;
    }

    visitReturn(stmt: ReturnStatement) {
        if (!this.insideFunction) {
            error({
                code: ErrorCode.ILLEGAL_RETURN_STATEMENT,
                reason: "Illegal return statement"
            });
        }

        if (stmt.argument) {
            this.visitExpression(stmt.argument);
        }
    }
}
