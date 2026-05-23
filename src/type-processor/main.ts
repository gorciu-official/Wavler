import { Statement, StructDeclaration, TypeNode } from "../definitions/ast-node.ts";

export class TypeProcessor {
    private ast: Statement[];
    private unionCounter = 0;
    private structs = new Map<string, StructDeclaration>();

    constructor(ast: Statement[]) {
        this.ast = ast;
    }

    public process(): Statement[] {
        let processed = this.ast;

        processed = this.mergeStructs(processed);
        processed = this.processUnionTypes(processed);
        processed = this.convertToLLVMTypes(processed);
        return processed;
    }

    private mergeStructs(nodes: Statement[]): Statement[] {
        for (const node of nodes) {
            if (node.type === "StructDeclaration") this.structs.set(node.name, node);
        }

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

    private processUnionTypes(nodes: Statement[]): Statement[] {
        const newNodes: Statement[] = [];
        for (const node of nodes) {
            if (node.type === "StructDeclaration") {
                for (const field of node.fields) {
                    if (field.type.kind === "UnionType") {
                        const unionName = `Union_${this.unionCounter++}`;
                        const newStruct: StructDeclaration = {
                            type: "StructDeclaration",
                            name: unionName,
                            fields: [
                                { name: "type_tag", type: { kind: "SimpleType", name: "i32" } },
                                ...field.type.types.map((t, i) => ({ name: `val${i}`, type: t }))
                            ]
                        };
                        newNodes.push(newStruct);
                        field.type = { kind: "SimpleType", name: unionName };
                    }
                }
            }
            newNodes.push(node);
        }
        return newNodes;
    }

    private convertToLLVMTypes(nodes: Statement[]): Statement[] {
        const llvmMap: Record<string, string> = {
            "int": "i32",
            "float": "float",
            "string": "string",
            "cstring": "cstring",
            "boolean": "i1",
            "bool": "i1",
            "void": "void"
        };

        const transform = (type: TypeNode): TypeNode => {
            if (type.kind === "SimpleType") {
                if (llvmMap[type.name]) {
                    return { kind: "SimpleType", name: llvmMap[type.name] };
                }
            }
            if (type.kind === "UnionType") {
                return { kind: "UnionType", types: type.types.map(transform) };
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
