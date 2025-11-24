import { z, Schema, AutoModel, Protofy } from "protobase";

Protofy("features", {

})

export const CardSchema = Schema.object(Protofy("schema", {
	name: z.string().search(),
    group: z.string().search(),
    tag: z.string().search(),
    id: z.string().id().search(),
    templateName: z.string().search(),
    defaults: z.record(z.any()).optional(),
}))

Protofy("api", {
    "name": "cards",
    "prefix": "/api/core/v1/"
})

export type CardType = z.infer<typeof CardSchema>;
export const CardModel = AutoModel.createDerived<CardType>("CardModel", CardSchema);