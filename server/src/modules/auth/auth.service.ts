import { db } from "../../config/db.js";
import { signToken } from "../../utils/jwt.js";
import { comparePassword } from "../../utils/password.js";
import type { LoginInput } from "../../validators/auth.schemas.js";

export async function login(input: LoginInput) {
    const user = await db.user.findUnique({
        where: { username: input.username },
        include: { shed: true },
    });
    if (!user) {
        return null;
    }
    const valid = await comparePassword(input.password, user.passwordHash);
    if (!valid || !user.isActive) {
        return null;
    }
    const token = signToken({
        userId: user.id,
        role: user.role,
        shedCode: user.shed?.code,
    });
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            shedId: user.shedId,
            shedCode: user.shed?.code ?? null,
        },
    };
}

export async function getMe(userId: number) {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { shed: true },
    });
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        shedId: user.shedId,
        shedCode: user.shed?.code ?? null,
    };
}
