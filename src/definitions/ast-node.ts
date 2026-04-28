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

export interface FunctionDeclaration {
    type: "FunctionDeclaration";
    name: string;
    params: { type: 'any', name: string }[];
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
