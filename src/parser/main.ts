import {
    ASTNode,
    BinaryOperator,
    Expression,
    ExpressionStatement,
    FunctionDeclaration,
    ReturnStatement,
    Statement,
    TypeNode,
    VariableDeclaration,
} from "../definitions/ast-node.ts";

import Token, { BaseToken, TokenType } from "../definitions/token.ts";
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

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private match(type: TokenType): boolean {
        if (this.peek().type === type) {
            this.advance();
            return true;
        }
        return false;
    }

    private expect(type: TokenType, msg: string): Token {
        const token = this.peek();

        if (token.type !== type) {
            return error({
                code: ErrorCode.UNEXPECTED_TOKEN,
                reason: msg,
                line: token.line
            });
        }

        return this.advance();
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

    private parseStatement(): Statement {
        const t = this.peek();

        if (t.type === TokenType.SEMICOLON) {
            this.advance();
            return { type: "EmptyStatement" };
        }

        switch (t.type) {
            case TokenType.FUNCTION_KEYWORD:
                return this.parseFunction();

            case TokenType.RETURN_KEYWORD:
                return this.parseReturn();

            case TokenType.LET_KEYWORD:
            case TokenType.CONST_KEYWORD:
                return this.parseVarDeclaration();

            case TokenType.WHILE_KEYWORD:
                return this.parseWhile();

            case TokenType.FOR_KEYWORD:
                return this.parseFor();

            default:
                return this.parseExpressionStatement();
        }
    }

    private parseBlock(): Statement[] {
        this.expect(TokenType.LBRACE, "Expected '{' to start block");

        const body: Statement[] = [];

        while (this.peek().type !== TokenType.RBRACE) {
            body.push(this.parseStatement());
        }

        this.expect(TokenType.RBRACE, "Expected '}' to close block");

        return body;
    }
    
    private isForOf(): boolean {
        let i = this.pos;
    
        if (this.tokens[i]?.type !== TokenType.FOR_KEYWORD) return false;
        i++;
    
        if (this.tokens[i]?.type !== TokenType.LPAREN) return false;
        i++;
    
        const first = this.tokens[i]?.type;
    
        if (first !== TokenType.LET_KEYWORD && first !== TokenType.CONST_KEYWORD) {
            return false;
        }
        i++;
    
        if (this.tokens[i]?.type !== TokenType.IDENTIFIER) return false;
        i++;
    
        if (this.tokens[i]?.type !== TokenType.OF_KEYWORD) return false;
    
        return true;
    }

    private parseFor(): Statement { 
        return this.isForOf() ? this.parseForOf() : this.parseForClassic();
    } 

    private parseWhile(): Statement {
        this.advance(); // while

        this.expect(TokenType.LPAREN, "Expected '(' after while");

        const condition = this.parseExpression(0);

        this.expect(TokenType.RPAREN, "Expected ')' after condition");

        const body =
            this.peek().type === TokenType.LBRACE
                ? this.parseBlock()
                : [this.parseStatement()];

        return {
            type: "WhileStatement",
            condition,
            body,
        };
    }

    private parseForClassic(): Statement {
        this.advance(); // for
        this.expect(TokenType.LPAREN, "Expected '(' after for");

        let init: Statement | null = null;

        if (this.peek().type !== TokenType.SEMICOLON) {
            if (
                this.peek().type === TokenType.LET_KEYWORD ||
                this.peek().type === TokenType.CONST_KEYWORD
            ) {
                init = this.parseVarDeclaration();
            } else {
                init = this.parseExpressionStatement();
            }
        }

        this.expect(TokenType.SEMICOLON, "Expected ';' after for-init");

        let condition: Expression | null = null;
        if (this.peek().type !== TokenType.SEMICOLON) {
            condition = this.parseExpression(0);
        }

        this.expect(TokenType.SEMICOLON, "Expected ';' after for-condition");

        let update: Expression | null = null;
        if (this.peek().type !== TokenType.RPAREN) {
            update = this.parseExpression(0);
        }

        this.expect(TokenType.RPAREN, "Expected ')' after for header");

        const body =
            this.peek().type === TokenType.LBRACE
                ? this.parseBlock()
                : [this.parseStatement()];

        return {
            type: "ForStatement",
            init,
            condition,
            update,
            body,
        };
    }

    private parseBinding(): { name: string; const: boolean } {
        const isConst = this.peek().type === TokenType.CONST_KEYWORD;

        this.advance();

        const name = this.expect(
            TokenType.IDENTIFIER,
            "Expected identifier in binding"
        ) as BaseToken<TokenType.IDENTIFIER, string>;

        return {
            name: name.value,
            const: isConst,
        };
    }

    private parseForOf(): Statement {
        this.advance(); // for
        this.expect(TokenType.LPAREN, "Expected '(' after for");

        const binding = this.parseBinding();

        this.expect(TokenType.OF_KEYWORD, "Expected 'of' in for-of");

        const iterable = this.parseExpression(0);

        this.expect(TokenType.RPAREN, "Expected ')' after for-of header");

        const body =
            this.peek().type === TokenType.LBRACE
                ? this.parseBlock()
                : [this.parseStatement()];

        return {
            type: "ForOfStatement",
            iterator: {
                const: binding.const,
                name: binding.name,
            },
            iterable,
            body,
        };
    }

    private parseVarDeclaration(): VariableDeclaration {
        const isConst = this.match(TokenType.CONST_KEYWORD);

        if (!isConst) this.expect(TokenType.LET_KEYWORD, "Expected let/const");

        const name = this.expect(
            TokenType.IDENTIFIER,
            "Expected variable name"
        ) as BaseToken<TokenType.IDENTIFIER, string>;

        this.expect(TokenType.COLON, "Expected : after variable name"); 
        const varType = this.parseType(); 

        this.expect(TokenType.ASSIGN_SIGN, "Expected '=' in variable declaration");

        const value = this.parseExpression(0);

        return {
            type: "VariableDeclaration",
            variable: {
                const: isConst,
                type: varType!,
                value,
                name: name.value,
            },
        };
    }

    private parseFunction(): FunctionDeclaration {
        this.advance(); // function

        const name = this.expect(
            TokenType.IDENTIFIER,
            "Expected function name"
        ) as BaseToken<TokenType.IDENTIFIER, string>;

        this.expect(TokenType.LPAREN, "Expected '(' after function name");

        const params: { name: string; type: TypeNode }[] = [];

        if (this.peek().type !== TokenType.RPAREN) {
            do {
                const p = this.expect(
                    TokenType.IDENTIFIER,
                    "Expected parameter name"
                ) as BaseToken<TokenType.IDENTIFIER, string>;

                this.expect(TokenType.COLON, "Expected ':' after parameter");

                const type = this.parseType();

                params.push({ name: p.value, type });
            } while (this.match(TokenType.COMMA));
        }

        this.expect(TokenType.RPAREN, "Expected ')' after params");

        let returnType: TypeNode = { kind: "SimpleType", name: 'void' };
        if (this.peek().type == TokenType.COLON) {
            this.advance(); // COLON 
            returnType = this.parseType();
        }

        this.expect(TokenType.LBRACE, "Expected '{' before function body");

        const body: Statement[] = [];

        while (this.peek().type !== TokenType.RBRACE) {
            body.push(this.parseStatement());
        }

        this.expect(TokenType.RBRACE, "Expected '}' after function body");

        return {
            type: "FunctionDeclaration",
            name: name.value,
            params,
            body, returnType
        };
    }

    private parseReturn(): ReturnStatement {
        this.advance();

        if (this.match(TokenType.SEMICOLON)) {
            return { type: "ReturnStatement", argument: null };
        }

        const arg = this.parseExpression(0);

        this.match(TokenType.SEMICOLON);

        return {
            type: "ReturnStatement",
            argument: arg,
        };
    }

    private parseExpressionStatement(): ExpressionStatement {
        const expr = this.parseExpression(0);

        this.match(TokenType.SEMICOLON);

        return {
            type: "ExpressionStatement",
            expression: expr,
        };
    }
   
    private parseType(): TypeNode {
        const left = this.parsePrimaryType();

        const types: TypeNode[] = [left];

        while (this.peek().type === TokenType.PIPE) {
            this.advance();
            types.push(this.parsePrimaryType());
        }

        return types.length === 1
            ? left
            : { kind: "UnionType", types };
    }

    private parsePrimaryType(): TypeNode {
        const token = this.expect(
            TokenType.IDENTIFIER,
            "Expected type identifier"
        ) as BaseToken<TokenType.IDENTIFIER, string>;

        return {
            kind: "SimpleType",
            name: token.value,
        };
    }

    private parseExpression(minBP: number): Expression {
        const token = this.advance();
        let left = this.nud(token);

        while (!this.isAtEnd()) {
            const next = this.peek();
            const bp = this.getBindingPower(next);

            if (!bp || bp.left < minBP) break;

            this.advance();
            left = this.led(next, left, bp);
        }

        return left;
    }

    private nud(token: Token): Expression {
        switch (token.type) {
            case TokenType.NUMBER:
                return { type: "NumberLiteral", value: token.value };

            case TokenType.IDENTIFIER:
                return { type: "Identifier", name: token.value };

            case TokenType.LPAREN: {
                const expr = this.parseExpression(0);
                this.expect(TokenType.RPAREN, "Expected ')'");
                return expr; 
            }

            default:
                return error({
                    code: ErrorCode.UNEXPECTED_TOKEN,
                    reason: "Unexpected token in expression",
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
