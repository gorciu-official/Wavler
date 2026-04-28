import { ASTNode, BinaryOperator, Expression, ExpressionStatement, FunctionDeclaration, ReturnStatement, Statement, TypeNode, VariableDeclaration } from "../definitions/ast-node.ts";
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

    parse(): Statement[] {
        const body: Statement[] = [];

        while (!this.isAtEnd()) {
            body.push(this.parseStatement()); 
        }

        return body;
    }

    private parseType(): TypeNode {
        return this.parseUnionType();
    }

    private parseUnionType(): TypeNode {
        const left = this.parsePrimaryType();
    
        const types: TypeNode[] = [left];
    
        while (this.peek().type === TokenType.PIPE) {
            this.consume(); // |
    
            types.push(this.parsePrimaryType());
        }
    
        return types.length === 1
            ? left
            : { kind: "UnionType", types };
    }

    private parsePrimaryType(): TypeNode {
        const token = this.consume();
    
        if (token.type !== TokenType.IDENTIFIER) {
            return error({
                code: ErrorCode.EXPECTED_IDENTIFIER,
                reason: "Expected type name",
            });
        }
    
        return {
            kind: "SimpleType",
            name: token.value,
        };
    }

    private parseStatement(): Statement {
        if (this.peek().type === TokenType.SEMICOLON) {
            this.consume();
            return {
                type: "EmptyStatement"
            };
        }

        const token = this.peek();

        switch (token.type) {
            case TokenType.FUNCTION_KEYWORD:
                return this.parseFunction();

            case TokenType.RETURN_KEYWORD:
                return this.parseReturn();

            case TokenType.LET_KEYWORD:
            case TokenType.CONST_KEYWORD: 
                return this.parseVarDeclaration();

            default:
                return this.parseExpressionStatement();
        }
    }

    private parseExpressionStatement(): ExpressionStatement {
        const expr = this.parseExpression(0);
    
        if (this.peek()?.type === TokenType.SEMICOLON) {
            this.consume();
        }
    
        return {
            type: "ExpressionStatement",
            expression: expr,
        };
    }

    private parseVarDeclaration(): VariableDeclaration {
        const is_const = this.peek().type == TokenType.CONST_KEYWORD;

        this.consume(); // LET_KEYWORD | CONST_KEYWORD
    
        const nameToken = this.consume();
        if (nameToken.type !== TokenType.IDENTIFIER) {
            return error({
                code: ErrorCode.EXPECTED_IDENTIFIER,
                reason: "Expected variable name",
            });
        }
    
        let varType: TypeNode | null = null;

        if (this.peek().type !== TokenType.COLON) {
            return error({
                code: ErrorCode.EXPECTED_IDENTIFIER,
                reason: "Expected ':' after parameter name",
            });
        }
        this.consume(); // : 
        varType = this.parseType(); 
    
        if (this.peek().type !== TokenType.ASSIGN_SIGN) {
            return error({
                code: ErrorCode.EXPECTED_EXPRESSION,
                reason: "Expected '=' after variable declaration",
            });
        }
    
        this.consume(); // =
    
        const value = this.parseExpression(0);
    
        return {
            type: "VariableDeclaration",
            variable: {
                const: is_const, type: varType,
                value, name: nameToken.value 
            } 
        };
    }

    private parseFunction(): FunctionDeclaration {
        this.consume(); // FUNCTION_KEYWORD
    
        const nameToken = this.consume();
        if (nameToken.type !== TokenType.IDENTIFIER) {
            return error({
                code: ErrorCode.EXPECTED_IDENTIFIER,
                reason: "Expected identifier"
            }); 
        }
    
        this.consume(); // LPAREN
    
        const params: { name: string, type: TypeNode }[] = [];
    
        if (this.peek().type !== TokenType.RPAREN) {
            do {
                const nameToken = this.consume();
                if (nameToken.type !== TokenType.IDENTIFIER) {
                    return error({
                        code: ErrorCode.EXPECTED_IDENTIFIER,
                        reason: "Expected parameter name",
                    });
                }
        
                if (this.peek().type !== TokenType.COLON) {
                    return error({
                        code: ErrorCode.EXPECTED_IDENTIFIER,
                        reason: "Expected ':' after parameter name",
                    });
                }
        
                this.consume(); // :
        
                const type = this.parseType();
        
                params.push({
                    type, name: nameToken.value
                });
        
            } while (
                this.peek().type === TokenType.COMMA &&
                this.consume()
            );
        } 
    
        this.consume(); // RPAREN
        this.consume(); // LBRACE
    
        const body: Statement[] = [];
    
        while (this.peek().type !== TokenType.RBRACE) {
            body.push(this.parseStatement());
        }
    
        this.consume(); // RBRACE
    
        return {
            type: "FunctionDeclaration",
            name: nameToken.value,
            params,
            body,
        };
    }

    private parseReturn(): ReturnStatement {
        this.consume(); // RETURN_KEYWORD
    
        if (this.peek().type === TokenType.SEMICOLON) {
            this.consume();
            return {
                type: "ReturnStatement",
                argument: null,
            };
        }
    
        const argument = this.parseExpression(0);
    
        if (this.peek().type === TokenType.SEMICOLON) {
            this.consume();
        }
    
        return {
            type: "ReturnStatement",
            argument,
        };
    }

    private parseExpression(minBP: number): Expression {
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

    private nud(token: Token): Expression {
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

    private led(token: Token, left: ASTNode, bp: BindingPower): Expression {
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
