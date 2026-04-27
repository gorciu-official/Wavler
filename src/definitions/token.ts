export enum TokenType {
    LBRACE, RBRACE,
    LPAREN, RPAREN,
    IDENTIFIER, NUMBER,
    STRING, TEMPLATE_STRING
}

export default interface Token {
    type: TokenType;
    value: string;
};
