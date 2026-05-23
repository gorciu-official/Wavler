export type ASTNode =
    | Expression
    | Statement;

export interface NumberLiteral {
    type: "NumberLiteral";
    value: number;
}

export interface StringLiteral {
    type: "StringLiteral";
    value: string;
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

export interface CallExpression {
    type: "CallExpression";
    callee: Expression;
    arguments: Expression[];
}

export type BinaryOperator =
    | "+"
    | "-"
    | "*"
    | "/"
    | "=="
    | "<"
    | ">"
    | "<<"
    | ">>";

export interface AssignmentExpression {
    type: "AssignmentExpression";
    left: Identifier;
    right: Expression;
}

export interface BreakStatement {
    type: "BreakStatement";
}

export interface ContinueStatement {
    type: "ContinueStatement";
}

export interface CaseClause {
    values: Expression[];
    body: Statement[];
}

export interface SwitchStatement {
    type: "SwitchStatement";
    discriminant: Expression;
    cases: CaseClause[];
}

export interface IfExpression {
    type: "IfExpression";
    condition: Expression;
    thenBranch: Statement[];
    elseBranch: Statement[] | null;
}

export interface MemberAccess {
    type: "MemberAccess";
    object: Expression;
    member: string;
}

export interface StructInstantiation {
    type: "StructInstantiation";
    structName: string;
    fields: { name: string; value: Expression }[];
}

export type Expression =
    | NumberLiteral
    | StringLiteral
    | Identifier
    | BinaryExpression
    | AssignmentExpression
    | CallExpression
    | IfExpression
    | MemberAccess
    | StructInstantiation;

export interface StructDeclaration {
    type: "StructDeclaration";
    name: string;
    extendsStruct?: string;
    fields: { name: string; type: TypeNode }[];
}

export type Statement =
    | FunctionDeclaration
    | ExternFunctionDeclaration
    | StructDeclaration
    | ReturnStatement
    | ExpressionStatement
    | VariableDeclaration
    | WhileStatement
    | ForStatement
    | ForOfStatement
    | SwitchStatement
    | BreakStatement
    | ContinueStatement
    | { type: "EmptyStatement" };

export type SimpleTypeNode = { kind: "SimpleType"; name: string };

export type FunctionTypeNode = {
    kind: "FunctionType";
    params: TypeNode[];
    returnType: TypeNode;
};

export type TypeNode =
    | SimpleTypeNode
    | FunctionTypeNode;

export interface FunctionDeclaration {
    type: "FunctionDeclaration";
    name: string;
    params: {name: string, type: TypeNode}[];
    body: Statement[]; returnType: TypeNode
}

export interface ExternFunctionDeclaration {
    type: "ExternFunctionDeclaration";
    name: string;
    params: {name: string, type: TypeNode}[];
    returnType: TypeNode;
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
