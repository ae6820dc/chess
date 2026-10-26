import {Enumeration} from './openings.js';
let enumeration;
self.onmessage=({data})=>{try {if(!enumeration)enumeration=new Enumeration({onProgress:p=>self.postMessage({progress:p})});enumeration.deadline=Date.now()+15000;enumeration.nodes=0;const result=enumeration.unrank(data.depth,data.rank);self.postMessage({result});}catch(e){self.postMessage({error:e.message});}};
