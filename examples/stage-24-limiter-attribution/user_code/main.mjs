import {createTranslationBank} from '../core/translation-bank.mjs'
import {assessDailyLimiterStages} from '../../../src/motion/daily-limiter-assessment.mjs'
const {vrm,bank,hipsRest}=createTranslationBank();
const result=await assessDailyLimiterStages(vrm,bank,{hipsRest,duration:12});
console.log(JSON.stringify({fixture:'original root-and-ankle translation, intentionally exceeds root speed cap; not a naturalness benchmark',...result},null,2));
