export type ASTNode =
    | Expression
    | Statement;

export interface NumberLiteral {
    type: "NumberLiteral";
    value: number;
}

export interface Identifier {
    type: "Identifier";
    name: string;
}

export interface BinaryExpression {
    type: "BinaryExpression";
    operator: BinaryOperator;
    left: ASTNode;
    right: ASTNode;
}

export type BinaryOperator =
    | "+"
    | "-"
    | "*"
    | "/"
    | "<"
    | ">"
    | "<<"
    | ">>";

export type Expression =
    | NumberLiteral
    | Identifier
    | BinaryExpression;

export type Statement =
    | FunctionDeclaration
    | ReturnStatement
    | ExpressionStatement
    | VariableDeclaration
    | WhileStatement
    | ForStatement
    | ForOfStatement
    | { type: "EmptyStatement" };

export type TypeNode =
    | { kind: "SimpleType"; name: string }
    | { kind: "UnionType"; types: TypeNode[] };

export interface FunctionDeclaration {
    type: "FunctionDeclaration";
    name: string;
    params: {name: string, type: TypeNode}[];
    body: Statement[]; returnType: TypeNode
}

export interface VariableDeclaration {
    type: "VariableDeclaration";
    variable: {
        name: string; type: TypeNode;
        const: boolean; value: Expression;
    }
}

export interface WhileStatement {
    type: "WhileStatement",
    condition: Expression,
    body: Statement[]
}

export interface ForStatement {
    type: "ForStatement";
    init: Statement | null;
    condition: Expression | null;
    update: Expression | null;
    body: Statement[];
}

export interface ForOfStatement {
    type: "ForOfStatement";
    iterator: {
        name: string;
        const: boolean;
    };
    iterable: Expression;
    body: Statement[];
}

export interface ReturnStatement {
    type: "ReturnStatement";
    argument: Expression | null;
}

export interface ExpressionStatement {
    type: "ExpressionStatement";
    expression: Expression;
}
