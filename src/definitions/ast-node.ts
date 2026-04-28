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
    | { type: "EmptyStatement" };

export type TypeNode =
    | { kind: "SimpleType"; name: string }
    | { kind: "UnionType"; types: TypeNode[] };

export interface FunctionDeclaration {
    type: "FunctionDeclaration";
    name: string;
    params: {name: string, type: TypeNode}[];
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
