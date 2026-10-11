import { calculateRisk, type RiskInput } from '../packages/domain/risk';
import type { Plan } from '../packages/domain/plan';
export const baseline:RiskInput={side:'long',budget:5_000_000n,quoteEntry:829929n,entryBound:829929n,stop:829099n,stressExit:829099n,leverage:500,maxLeverage:1500,maintenanceDenominator:2500,takerFeeMicros:345,fundingReserve:0n,operationalReserve:0n,availableCollateral:1_000_000_000n,priceDecimals:1,sizeDecimals:5,collateralDecimals:6};
export function makePlan():Plan{return {version:1,id:'test-plan',revision:1,binding:{chainId:10143,instanceId:'12',exchange:'0x1964c32f0be608e7d29302aff5e61268e72080cc',collateral:'0xa9012a055bd4e0edff8ce09f960291c09d5322dc',marketId:'16',perpetualId:'16',accountId:'42',wallet:'0x1111111111111111111111111111111111111111'},input:baseline,quote:calculateRisk(baseline),configDigest:'config',bookBlock:'100',receivedAt:1000,expiresAt:4000};}
export const p={at:{b:100,t:1000},mkt:16,acc:42,pid:1,rq:1,oid:1,st:1,sr:1,sd:1,c:'1000000',ep:829929,s:100,fee:'10',lv:500,ots:{b:100,t:1000},efs:0,xfs:0};
export const o={at:{b:100,t:1000},mkt:16,acc:42,oid:2,rq:2,st:8,sr:60,t:3,os:100,fs:0,fp:0,f:'0',tp:820000,tpc:4,lp:1,fl:4,lv:0};
