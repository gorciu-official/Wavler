export type ASTNode =
    | NumberLiteral
    | Identifier
    | BinaryExpression;

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
