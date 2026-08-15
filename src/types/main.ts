import { Statement, StructDeclaration, TypeNode } from "../definitions/ast-node.ts";

export class TypeProcessor {
    private ast: Statement[];
    private structs = new Map<string, StructDeclaration>();
    private aliases = new Map<string, string>();

    constructor(ast: Statement[]) {
        this.ast = ast;
    }

    public getAliases(): Map<string, string> {
        return this.aliases;
    }

    public process(): Statement[] {
        let processed = this.ast;

        processed = this.collectDefinitions(processed);
        processed = this.mergeStructs(processed);
        processed = this.convertToLLVMTypes(processed);
        return processed;
    }

    private collectDefinitions(nodes: Statement[]): Statement[] {
        return nodes.filter(node => {
            if (node.type === "StructDeclaration") {
                this.structs.set(node.name, node);
                return true;
            } else if (node.type === "TypeAliasDeclaration") {
                this.aliases.set(node.name, node.base_type);
                return false;
            }
            return true;
        });
    }

    private mergeStructs(nodes: Statement[]): Statement[] {
        for (const struct of this.structs.values()) {
            if (struct.extendsStruct) {
                const parent = this.structs.get(struct.extendsStruct);
                if (parent) {
                    const childFieldNames = new Set(struct.fields.map(f => f.name));
                    const inheritedFields = parent.fields.filter(f => !childFieldNames.has(f.name));
                    struct.fields = [...inheritedFields, ...struct.fields];
                    delete struct.extendsStruct;
                }
            }
        }
        return nodes;
    }

    private convertToLLVMTypes(nodes: Statement[]): Statement[] {
        const llvmMap: Record<string, string> = {
            "int": "i32",
            "float": "float",
            "string": "string",
            "boolean": "i1",
            "bool": "i1",
            "void": "void"
        };

        const resolveAlias = (name: string): string => {
            if (this.aliases.has(name)) {
                return resolveAlias(this.aliases.get(name)!);
            }
            return name;
        };

        const transform = (type: TypeNode): TypeNode => {
            if (type.kind === "SimpleType") {
                const resolvedName = resolveAlias(type.name);
                
                if (llvmMap[resolvedName]) {
                    return { kind: "SimpleType", name: llvmMap[resolvedName] };
                } else if (Object.keys(llvmMap).some(t => resolvedName == `*${t}`)) {
                    return { kind: "SimpleType", name: 'ptr' }
                }
                
                return { kind: "SimpleType", name: resolvedName };
            }
            if (type.kind === "FunctionType") {
                return {
                    kind: "FunctionType",
                    params: type.params.map(transform),
                    returnType: transform(type.returnType)
                };
            }
            return type;
        };

        for (const node of nodes) {
            if (node.type === "StructDeclaration") {
                node.fields.forEach(f => f.type = transform(f.type));
            } else if (node.type === "FunctionDeclaration" || node.type === "ExternFunctionDeclaration") {
                node.params.forEach(p => p.type = transform(p.type));
                node.returnType = transform(node.returnType);
            } else if (node.type === "VariableDeclaration") {
                node.variable.type = transform(node.variable.type);
            }
        }
        return nodes;
    }
}
