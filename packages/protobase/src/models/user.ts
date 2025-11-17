import { z, Schema } from "../BaseSchema";
import moment from "moment";
import { ProtoModel } from "../ProtoModel";
import { SessionDataType } from "../lib/perms";

export const UserSchema = Schema.object({
    username: z.string().label('username').hint('admin, john, ...').static().id().search(),
    type: z.string().min(1).label("group").hint('user, admin, ...').search().generate('user').help("The type refers to a group name. Groups contains privileges (admin true/false) and workspaces.").indexed(),
    password: z.string().min(6).hint('**********').secret().hidden(["sheet", "list", "preview"]).onCreate('cypher').onUpdate('update').onRead('clearPassword').onList('clearPassword').help("Salted hashed password using bcrypt."),
    permissions: z.array(z.string()).optional().label("additional permissions"),
    createdAt: z.string().min(1).generate((obj) => moment().toISOString()).search().hidden(["edit", "add"]).indexed(),
    lastLogin: z.string().optional().search().hidden(["edit", "add"]).indexed(),
    from: z.string().min(1).search().generate((obj) => 'admin').help("Interface used to create the user. Users can be created from command line or from the admin panel").hidden(["edit", "add"])
})
export type UserType = z.infer<typeof UserSchema>;
export class UserModel extends ProtoModel<UserModel> {
    constructor(data: UserType, session?: SessionDataType) {
        super(data, UserSchema, session, "User");
    }

    static load(data: any, session?: SessionDataType): UserModel {
        return this._newInstance(data, session);
    }

    protected static _newInstance(data: any, session?: SessionDataType): UserModel {
        return new UserModel(data, session);
    }
}
