import { z } from "../BaseSchema";

export const LoginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
});

export type LoginRequest = z.infer<typeof LoginSchema>;

const BaseRegisterSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    rePassword: z.any()
})

export const RegisterSchema = BaseRegisterSchema.refine(obj => obj.password === obj.rePassword, {
    message: 'Passwords do not match',
    path: ['password'], // this value is concatenated to the end of the actual path of the error
});

const hasType = z.object({
    type: z.string().min(1)
})

export const CmdRegisterSchema = z.object({
    ...BaseRegisterSchema.omit({rePassword: true}).shape,
    ...hasType.shape
})

export type CmdRegisterRequest = z.infer<typeof CmdRegisterSchema>;
export type RegisterRequest = z.infer<typeof RegisterSchema>;