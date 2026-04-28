import { ASTNode, BinaryOperator } from "../definitions/ast-node.ts";
import Token, { TokenType } from "../definitions/token.ts";
import { error, ErrorCode } from "../logging.ts";

export class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    private peek(): Token | null {
        return this.tokens[this.pos] ?? null;
    }

    private consume(): Token {
        return this.tokens[this.pos++];
    }

    private match(...types: TokenType[]): boolean {
        const token = this.peek();
        if (!token) return false;
        return types.includes(token.type);
    }

    parse(): ASTNode {
        return this.parseBitshift();
    }

    private parseBitshift(): ASTNode {
        let left = this.parseComparison();

        while (this.match(TokenType.BITSHIFT_LEFT, TokenType.BITSHIFT_RIGHT)) {
            const operator = this.consume().value;
            const right = this.parseComparison();

            left = {
                type: "BinaryExpression",
                operator: operator as BinaryOperator,
                left,
                right,
            };
        }

        return left;
    }

    private parseComparison(): ASTNode {
        let left = this.parseAdditive();

        while (this.match(TokenType.LESS_THAN, TokenType.GREATER_THAN)) {
            const operator = this.consume().value;
            const right = this.parseAdditive();

            left = {
                type: "BinaryExpression",
                operator: operator as BinaryOperator,
                left,
                right,
            };
        }

        return left;
    }

    private parseAdditive(): ASTNode {
        let left = this.parseMultiplicative();

        while (this.match(TokenType.PLUS_SIGN, TokenType.MINUS_SIGN)) {
            const operator = this.consume().value;
            const right = this.parseMultiplicative();

            left = {
                type: "BinaryExpression",
                operator: operator as BinaryOperator,
                left,
                right,
            };
        }

        return left;
    }

    private parseMultiplicative(): ASTNode {
        let left = this.parsePrimary();

        while (this.match(TokenType.STAR_SIGN, TokenType.SLASH_SIGN)) {
            const operator = this.consume().value;
            const right = this.parsePrimary();

            left = {
                type: "BinaryExpression",
                operator: operator as BinaryOperator,
                left,
                right,
            };
        }

        return left;
    }

    private parsePrimary(): ASTNode {
        const token = this.consume();

        switch (token.type) {
        case TokenType.NUMBER:
            return {
                type: "NumberLiteral",
                value: token.value,
            };

        case TokenType.IDENTIFIER:
            return {
                type: "Identifier",
                name: token.value,
            };

        case TokenType.LPAREN: {
            const expr = this.parse();
            this.consume(); // RPAREN
            return expr;
        }

        default:
            return error({
                code: ErrorCode.EXPECTED_IDENTIFIER,
                reason: "Expected identifier"
            }); 
        }
    }
}
