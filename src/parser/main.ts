import { ASTNode, BinaryOperator } from "../definitions/ast-node.ts";
import Token, { TokenType } from "../definitions/token.ts";
import { error, ErrorCode } from "../logging.ts";

interface BindingPower {
    left: number;
    right: number;
}

export class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private consume(): Token {
        return this.tokens[this.pos++];
    }

    private isAtEnd(): boolean {
        return this.pos >= this.tokens.length;
    }

    parse(): ASTNode[] {
        const body: ASTNode[] = [];

        while (!this.isAtEnd()) {
            body.push(this.parseExpression(0));
    
            if (this.peek()?.type === TokenType.SEMICOLON) {
                this.consume();
            }
        }    

        return body;
    }

    private parseExpression(minBP: number): ASTNode {
        const token = this.consume();
        let left = this.nud(token);

        while (!this.isAtEnd()) {
            const next = this.peek();
            const bp = this.getBindingPower(next);

            if (!bp || bp.left < minBP) break;

            this.consume();
            left = this.led(next, left, bp);
        }

        return left;
    }

    private nud(token: Token): ASTNode {
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
            const expr = this.parseExpression(0);
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

    private led(token: Token, left: ASTNode, bp: BindingPower): ASTNode {
        const right = this.parseExpression(bp.right);

        return {
            type: "BinaryExpression",
            operator: token.value as BinaryOperator,
            left,
            right,
        };
    }

    private getBindingPower(token: Token): BindingPower | null {
        switch (token.type) {
        case TokenType.STAR_SIGN:
        case TokenType.SLASH_SIGN:
            return { left: 50, right: 51 };

        case TokenType.PLUS_SIGN:
        case TokenType.MINUS_SIGN:
            return { left: 40, right: 41 };

        case TokenType.LESS_THAN:
        case TokenType.GREATER_THAN:
            return { left: 30, right: 31 };

        case TokenType.BITSHIFT_LEFT:
        case TokenType.BITSHIFT_RIGHT:
            return { left: 20, right: 21 };

        default:
            return null;
        }
    }
}
