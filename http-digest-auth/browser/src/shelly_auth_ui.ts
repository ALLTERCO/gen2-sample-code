import {HexHash,JRPCPost_t,setlog,shellyHttpCall} from './shelly_http_call.js'

const mainui={
	host:<HTMLInputElement><any>null,
	port:<HTMLInputElement><any>null,
	password:<HTMLInputElement><any>null,
	method:<HTMLInputElement><any>null,
	params:<HTMLInputElement><any>null,
	log:<HTMLTextAreaElement><any>null,
}

function ls_persist(){
	localStorage.setItem('host',mainui.host.value);
	localStorage.setItem('port',mainui.port.value);
	localStorage.setItem('password',mainui.password.value); //don't do this in non-testing scenarios 
	localStorage.setItem('method',mainui.method.value);
	localStorage.setItem('params',mainui.params.value);
}
function ls_getItem_def(key:string,def:string):string{
	const res=localStorage.getItem(key);
	if (res!==null) return res;
	return def;
}

export function addlog(msg:string){
	mainui.log.value=mainui.log.value+"\r\n"+msg;
}
setlog(addlog);

function fill_ui_holder (holder:Record<string,HTMLElement>,selector:string,src:Element=document.body) {
	const elems=src.querySelectorAll(selector);
	for (let i=0; i<elems.length; i++) {
		const e=elems.item(i);
		if (! (e instanceof HTMLElement)) continue;

		let bindname=e.getAttribute('data-bind');
		if (bindname===null){
			bindname=e.getAttribute('name');
			if (bindname===null){
				bindname=e.getAttribute('id');
			}
		}
		if (bindname===null) continue;
		if (holder.hasOwnProperty(bindname)) holder[bindname]=e;
	}
	let failed_binds:string[]=[];
	for (let k in  holder) if (holder[k]==null) failed_binds.push(k)
	if (failed_binds.length>0)throw new Error('Binds failed with selector '+selector+' missing elements:'+failed_binds.join(','));
}

export function init (){
	fill_ui_holder(mainui,'.js_mainui');
	const h=HexHash('1234567890');
	if (h==='c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646') {
		addlog("sha256 seems to work OK on this browser .. good!");
	} else {
		addlog("sha256 seems to be BROKEN on this browser!");
		return;
	}
	mainui.host.value=ls_getItem_def('host','');
	mainui.port.value=ls_getItem_def('port','80');
	mainui.password.value=ls_getItem_def('password',''); //don't do this in non-testing scenarios
	mainui.method.value=ls_getItem_def('method','Shelly.GetStatus');
	mainui.params.value=ls_getItem_def('params','');
}

export function clearlog() {
	mainui.log.value='';
}

export function call_jrpc() {
	let postData:JRPCPost_t={
		id:0,
		method:mainui.method.value
	}

	const port=Number(mainui.port.value);
	if (!(port>0 && port<65536)) {
		addlog("Port should be in range 1 to 65535 inclusively!");

	}
	if (mainui.params.value!='') {
		try {
			postData.params = JSON.parse(mainui.params.value);
		} catch (err) {
			addlog("Params fail to parse. This MUST be strinct JSON. Check if you need to wrap the params in ' ");
			return;
		};
	}
	ls_persist();

	shellyHttpCall(postData, mainui.host.value, port, mainui.password.value).then((data) => {
		if (postData.auth) {
			addlog("Device response post auth: ");
		} else {
			addlog("Device response pre auth: ");
		}
		try {
			addlog(JSON.stringify(JSON.parse(data), null, 2));
		} catch (e) {
			addlog("failed to parse the responce from the device!");
		}
	}).catch((err) => {
		addlog("Request failed :"+ String(err));
	});
}

