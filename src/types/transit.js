/** @typedef {'TRTC'|'TYMC'} Operator */
/** @typedef {'LIVE'|'ESTIMATED'|'SCHEDULED'} SourceType */
/** @typedef {{id:string,name:string,x:number,y:number}} Station */
/** @typedef {{id:string,operator:Operator,name:string,color:string,stations:Station[]}} RailLine */
/** @typedef {{id:string,operator:Operator,lineId:string,trainType:'LOCAL'|'EXPRESS',direction:0|1,fromStation:string,toStation:string,departureTime:string,arrivalTime:string,progress:number,source:SourceType,updatedAt:string,departureSec:number,arrivalSec:number}} TrainState */
