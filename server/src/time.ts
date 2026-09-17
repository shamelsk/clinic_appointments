import {DateTime} from 'luxon'; import {ApiError} from './errors.js';
export const timezone=()=>process.env.CLINIC_TIMEZONE||'Asia/Kolkata';
export function appointmentTime(date:string,time:string){const dt=DateTime.fromFormat(`${date} ${time}`,'yyyy-MM-dd HH:mm',{zone:timezone()});if(!dt.isValid||dt.minute%15!==0||dt.second!==0)throw new ApiError(400,'VALIDATION_ERROR','Start time must be on a 15-minute boundary.');return dt;}
export function dayRange(date:string){const d=DateTime.fromISO(date,{zone:timezone()});if(!d.isValid)throw new ApiError(400,'VALIDATION_ERROR','Date must use YYYY-MM-DD.');return {start:d.startOf('day').toUTC().toJSDate(),end:d.endOf('day').toUTC().toJSDate()};}
export const phone=(v:string)=>{const n=v.trim().replace(/[\s()-]/g,'');if(!/^\+?[0-9]{7,15}$/.test(n))throw new ApiError(400,'VALIDATION_ERROR','Provide a valid phone number.'); return n.startsWith('+')?n:`+${n}`};
