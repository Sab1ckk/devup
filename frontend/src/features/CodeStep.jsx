import {Field,ErrorHint} from '../components/UI';
import useMailStatus from '../hooks/useMailStatus';
export default function CodeStep({name='code',value,onChange,mailId,message,wait,busy,onResend,onBack}){
 const mail=useMailStatus(mailId);
 return <><p>{message}</p><Field label="Код подтверждения" name={name} autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={value} onChange={e=>onChange(e.target.value.replace(/\D/g,''))}/>{mail?.status==='failed'&&<ErrorHint error={mail.message}/>}<div className="cta"><button className="btn btn-sm" type="button" disabled={busy||wait>0} onClick={onResend}>{wait?`Отправить ещё раз через ${wait} с`:'Отправить код ещё раз'}</button><button className="btn btn-sm" type="button" disabled={busy} onClick={onBack}>Назад</button></div></>
}
