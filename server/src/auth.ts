import type {NextFunction,Request,Response} from 'express'; import jwt from 'jsonwebtoken'; import {Role} from '@prisma/client'; import {ApiError} from './errors.js';
const secret=()=>process.env.JWT_SECRET||'development-only-secret-change-before-production'; export type AuthUser={id:string;name:string;email:string;role:Role};
declare global { namespace Express { interface Request { user?:AuthUser } } }
export const sign=(u:AuthUser)=>jwt.sign(u,secret(),{expiresIn:'8h'});
export function setAuthCookie(res:Response,token:string){res.cookie('clinic_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000});}
export function authenticate(req:Request,_res:Response,next:NextFunction){try{const token=req.cookies?.clinic_session||req.headers.authorization?.replace(/^Bearer\s+/,'');if(!token)throw new Error();req.user=jwt.verify(token,secret()) as AuthUser;next()}catch{next(new ApiError(401,'UNAUTHENTICATED','Please sign in to continue.'))}}
export const authorize=(...roles:Role[])=>(req:Request,_res:Response,next:NextFunction)=>!req.user?next(new ApiError(401,'UNAUTHENTICATED','Please sign in to continue.')):roles.includes(req.user.role)?next():next(new ApiError(403,'FORBIDDEN','You do not have permission for this action.'));
