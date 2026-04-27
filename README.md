# Wavler

Wavler is pretty must just my first real attempt to make a programming language. It currently contains no AI code (that may change lmao).

**How to run?**

`deno run -A src/main.ts` (you may tighten permissions, --allow-read should be enough)

If you want to pass the file instead of random testing code, pass it as fifth argument.

**Why in TypeScript?**

1. I [love this language](https://gorciu.neocities.org/?site=shrines%2Ftypescript)!
2. I decided to make a language heavily inspired by TypeScript, but compiled!
3. So it will be easier later to make a self-hosted compiler.

**Roadmap**

1. [ ] Keyword support in lexer 
2. [ ] Support for template strings in lexer 
3. [ ] Text preprocessor
4. [X] EOF handling for unterminated strings
5. [ ] Numbers support in lexer 
6. [ ] Base operation signs (like `+`, `-`, `*`, `/`)
7. [ ] Bitshift lexer support

That's for now lmao.
