import { TypeNode } from "./ast-node.ts";

export type Symbol = {
    name: string;
    type: TypeNode;
    mutable: boolean;
};
