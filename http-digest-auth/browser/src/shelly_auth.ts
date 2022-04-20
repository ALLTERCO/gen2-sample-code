//HexHash('1234567890')==c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646;
import { buffer } from 'stream/consumers';
import {RawSha256} from './RawSha256.js';

const hexab = '0123456789abcdef';
//const hexab = '0123456789ABCDEF';

function HexHash(s:string):string {
	const h=new RawSha256();
	h.update(new TextEncoder().encode(s));
	let res='';
	const digb=h.digest();
	for (let b of digb) {
		res+= hexab[b >> 4] + hexab[b & 15];;
	}
	return res;
}

export function init (){
	const h=HexHash('1234567890');
	console.log("inited! tv:"+h+" ok:"+(h=='c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646'));
}
console.log("parsed!");
