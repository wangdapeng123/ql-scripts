/*
    gjzz 签到
    自动添加任务后，如果时间不对，请自己修改 10 0,10 * * *

    [Script]
    cron "0 10 0,7,10 * * ?" script-path=kbg_58sjb.js, tag=58同城我家收取金币, enabled=true
*/
const axios = require("axios");
const jsname = '58同城我家收取金币'
const $ = Env('58同城我家收取金币')
const logDebug = 0

const ckkey = 'wbtcCookie';

const notifyFlag = 1; //0为关闭通知，1为打开通知,默认为1
//const notify = $.isNode() ? require('./sendNotify') : '';
let notifyStr = ''

let httpResult //global buffer

//let userCookie = 'PPU=UID=88529706992435&UN=sqk8p6gkt&TT=354a468fd148c589fe46d813ef517e98&PBODY=B83N4y2LdYM75BceLbDz8wXATSXi6wTCN8GTSZq8gBE648-nbYuk4fKVu1esl2lQruhCPfKWGGWv81grEtgd2YWDg2vX4u5WrqCS5wfJzvaIGVQyckNB8k7ChugBPRdW96VvmzkJhvws-7Tr5TTj_88CSNclJ-JTZKRkToZaaxI&VER=1&CUID=SwwkFOIjAqZVdYBKPUo4Lg#1@PPU=UID=54402120302351&UN=sn280q6ir&TT=aadbee7beb303d53fcbf8ee986a4a764&PBODY=ihR3d0fGwQqq9uddd_Idx_cj02pNxhNr7WTj16As6mMQWK-KHkpGp0Bz3793pC5nPcqX9Kldp-WhN5K0fZ_GF_2OeeFsj5Jr5mzZ4M37aa-xXnYAMnNF3tzgzgjz7LNIhxi6P-GDchpQsItG0JVKUyLgRPwFmafMP23zYbnmIac&VER=1&CUID=m5Seg793ugyGYph7h_ctZw#1@PPU=UID=88693105101867&UN=eoorptgar&TT=82fa6f25b060efd8b307290c7c0891e9&PBODY=GSSc43-RAknPkFjgR6s-eHIFj79iCrVxBVGuMEQM9SjDtGFkTH0XyuQxswigbEte51mEDntdSRJ8TqdpMXwlPNyh_QFCBCLYP7tvJT4r9v0flm7n_SOPnIDyIGfIFBiYFGvCPqqmbuez9Ffk8aoIDfv4oddqQjr6MMqFTsmVh9A&VER=1&CUID=8sTBgQ91PmySpvjJLQX5XQ#1@PPU=UID=88663072651010&UN=2ku6gu7iw&TT=ea07e374a7fabdf295b780fd44fd9060&PBODY=eiC9BReoBJca4Y5TCrGrVP-zueTLaunAZCxgzTzrNFj07Wz4ZVDL88X2eBnVxSRUf3zJcFIq8XIIyamPuMYeRwGQCQAAnuP95SIO1G_tqhXptQ912tMfiRqufYjdqsYUZ883PfFfKhXimLXciSwOuyPA8FD0zYTbFHSxSLqfG1U&VER=1&CUID=r0f997a6BgAPJmiVoKSmQQ#1@PPU=UID=89046758285828&UN=byenjnl5h&TT=104773d62f23d8b5cb9e6eac8ecbf60f&PBODY=iWu2d-fq1j_hHHOr-USg2V2WhSetGUQrbZBjp4sFuQ_gjHGJdUtJmsfbDvTxwLfZU3UWpsRjaB3HsEswR75zPq3qHbVftXPzcYsPyy8bTSvAGIdhKguAv287g_eSF2NPA23OiZTOm8ZiLB1MPkieC_pxH0PChtNt_nBwJZnsaTc&VER=1&CUID=842xdMuLhg-pnb6aknuVOA#1@PPU=UID=89047189096200&UN=d1xs6orts&TT=ad02806ae811c695e6ddc8453169ae51&PBODY=UYMqNlkhqLqHdsDGwUZqOmmVAtFvioJciycxXjSTQTUgsF4zWbFJwqQaQQtn9MQIZh6rmYPDUojxzer6lJi1fb-15s_inA2IfpXWGXpS42irE2nM5jAeTaNETeVHU1BxaCXT3euCxFwSc0aLKU9X3onYeJVlCtlvBPdS2uD0Xek&VER=1&CUID=o7Yttr9AXNQQJKSb6fIKDg#1'
//let userUA = 'Dalvik/2.1.0 (Linux; U; Android 12; M2012K11AC Build/SKQ1.220303.001)'

let userCookie = ($.isNode() ? process.env[ckkey] : $.getdata(ckkey)) || '';

let userUA = ($.isNode() ? process.env.gjzzUA : $.getdata('wbtcUA')) || 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WUBA/10.26.5';
let userList = []

let userIdx = 0
let userCount = 0

let disableStartTime = "" //以下时间段不做任务
let disableEndTime = "" //以下时间段不做任务
let curHour = (new Date()).getHours()

///////////////////////////////////////////////////////////////////
class UserInfo {
    constructor(str) {
        let strArr = str.split('#')
        this.index = ++userIdx
        this.nickName = ''
        this.cookie = strArr[0]
        this.login = false
        this.inited = false // 是否完成游戏引导
        this.house = {}
        this.runTask = strArr[1] || 0
        this.runTaskStrs = {
            1: '已绑定微信，已实名，可提现，可执行全部任务',
            2: '已绑定微信，未实名，不可提现，可执行部分任务',
            3: '未绑定微信，未实名，不可提现，可执行部分任务',
        }
        console.log(`账号[${this.index}]状态为：${this.runTaskStrs[this.runTask]}`)
    }


    // 查询登录状态
    async checkLogin() {
        let url = `https://lovely-house.58.com/sign/info`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            this.login = true
        } else {
            console.log(`账号[${this.index}]登录状态: ${result.message}`)
            this.login = !(result.message === '请登陆')
        }
    }






    // 赶集直招签到
    async gjzzqiandao() {
        let url = `https://gjgrowthoper.58.com/clock/clockin`
        let body = `state=1`
        // let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            addNotifyStr(`账号[${this.index}-${this.nickName}]赶集直招签到成功`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]赶集直招签到失败: ${result.message}`)
        }
    }
    // 获取可领取列表
    async goldCoinBallquery() {
        let url = `https://gjgrowthoper.58.com/goldCoinBall/query`
        //let body = `state=1`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(JSON.stringify(result))
        if(result.code == 0) {

            if( !(JSON.stringify(result.resultEntity) == "{}")){
                var length=result.resultEntity.awardList.length;
                for (let i =0 ; i < length; i++) {
                    await $.wait(1000);
                    //console.log(JSON.stringify(result))
                    var ballSource=result.resultEntity.awardList[i].ballSource
                    console.log(`账号[${this.index}-${this.nickName}]梦想小镇无 可领取任务名称-${ballSource}`)
                    //现金签到才领取 其他领取的殴都是一金币 没必要
                    if(result.resultEntity.awardList[i].awardType=='1'){
                        await this.goldCoinBallobtain(result.resultEntity.awardList[i]);
                    }
                }
            }else{
                console.log(`账号[${this.index}-${this.nickName}]梦想小镇无可领取领取金币`)
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]梦想小镇无可领取领取金币失败: ${result.message}`)
        }
    }
    // 领取昨晚的任务的金币
    async goldCoinBallobtain(data) {
        let id = data.id;
        let awardType = data.awardType;
        console.log(JSON.stringify(data))
        let url = `https://gjgrowthoper.58.com/goldCoinBall/obtain`
        //let body = `state=1`
        let body = `awardId=${id}&awardType=${awardType}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            if(result.resultEntity.state!=6){
                console.log(`账号[${this.index}-${this.nickName}]--${data.ballSource} 任务领取金币成功`)
            }else{
                console.log(`账号[${this.index}-${this.nickName}]--${data.ballSource} 任务领取金币失败，需要实名`)

            }
        } else {
            console.log(`账号[${this.index}-${this.nickName}]--${data.ballSource} 任务领取金币失败`)

        }
    }
}

!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite()
    }else {
        getUserCookie();
        if(!(await checkEnv())) return
        console.log('====================\n')
        console.log(`如果要自定义UA，请把UA填到wbtcUA里，现在使用的UA是：\n${userUA}`)

        // // 设置了禁止推送时间段 以下时间段不做任务
        // if (disableStartTime && disableEndTime) {
        //     const date = new Date();
        //     const dateTimes = date.getTime();
        //     const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
        //     const year = `${y}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`

        //     const start = new Date(`${year} ${disableStartTime}`).getTime();
        //     const end   = new Date(`${year} ${disableEndTime}`).getTime();
        //     if (dateTimes > start && dateTimes<end) {
        //         console.log('设置了禁止推送时间段 以下时间段不做任务');
        //         return;
        //     }
        // }

        // await $.wait(delay()); //  随机延时

        console.log('\n======== 检查登录状态 ========')
        // 检查登录状态
        for(let user of userList) {
            await user.checkLogin();
            await $.wait(200);
        }
        userList = userList.filter(x=>{
            return x.login
        })

        console.log('\n============ 赶集直招签到 ============')
        for(let user of userList) {
            //签到
            await user.gjzzqiandao();
            await $.wait(200);

            //领取奖励
            await user.goldCoinBallquery();
        }

        showmsg()
    }
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done())

///////////////////////////////////////////////////////////////////
async function getUserCookie () {
    if (userCookie) return;
    userCookie = '';
    const ckStr = process.env.globalConf;
    if (ckStr) {
        const ckInfo = JSON.parse(ckStr) || {};
        const list = ckInfo[ckkey]?.cks || [];
        for (let i = 0; i < list.length; i++) {
            const {ck, runState, splitor} = list[i];
            userCookie+=`${ck}#${runState}${splitor}`
        }

        disableStartTime = ckInfo[ckkey]?.disableStartTime || '';
        disableEndTime = ckInfo[ckkey]?.disableEndTime || '';
    }
}
async function checkEnv() {
    if(userCookie) {
        for(let userCookies of userCookie.split('@')) {
            if(userCookies) userList.push(new UserInfo(userCookies))
        }
        userCount = userList.length
    } else {
        console.log('未找到wbtcCookie')
        return;
    }

    console.log(`共找到${userCount}个账号`)
    return true
}

async function GetRewrite() {
    if($request.url.indexOf('getIndexSignInInfo') > -1) {
        let ppu = $request.headers.ppu ? $request.headers.ppu : $request.headers.PPU
        if(!ppu) return;
        let uid = ppu.match(/UID=(\w+)/)[1]
        let ck = 'PPU=' + ppu

        if(userCookie) {
            if(userCookie.indexOf('UID='+uid) == -1) {
                userCookie = userCookie + '@' + ck
                $.setdata(userCookie, ckkey);
                ckList = userCookie.split('@')
                $.msg(jsname+` 获取第${ckList.length}个${ckkey}成功: ${ck}`)
            } else {
                console.log(jsname+` 找到重复的${ckkey}，准备替换: ${ck}`)
                ckList = userCookie.split('@')
                for(let i=0; i<ckList.length; i++) {
                    if(ckList[i].indexOf('UID='+uid) > -1) {
                        ckList[i] = ck
                        break;
                    }
                }
                userCookie = ckList.join('@')
                $.setdata(userCookie, ckkey);
            }
        } else {
            $.setdata(ck, ckkey);
            $.msg(jsname+` 获取第1个${ckkey}成功: ${ck}`)
        }
    }
}

function addNotifyStr (str, log=true) {
    if (log) {
        console.log(`${str}\n`)
    }
    notifyStr+=`${str}\n`
}
//通知
async function showmsg() {
    if(!(notifyStr &&  curHour == 22 || notifyStr.includes('失败'))) return
    notifyBody = jsname + "运行通知\n\n" + notifyStr
    if (notifyFlag == 1) {
        $.msg(notifyBody);
        if($.isNode()){await notify.sendNotify($.name, notifyBody );}
    } else {
        console.log(notifyBody);
    }
}
////////////////////////////////////////////////////////////////////
function populateUrlObject(url,cookie,body=''){
    let host = (url.split('//')[1]).split('/')[0]
    let urlObject = {
        url: url,
        headers: {
            'Host' : host,
            'Cookie' : cookie,
            'Connection' : 'keep-alive',
            'Accept' : 'application/json, text/plain, */*',
            'user-agent' : userUA,
            'Accept-Language' : 'zh-CN,zh-Hans;q=0.9',
            'Accept-Encoding' : 'gzip, deflate, br',
        },
    }
    if(body) urlObject.body = body
    return urlObject;
}

async function httpRequest(method,url) {
    httpResult = null
    //let data;
    if (method == 'post') {
        url.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        if (url.body) {
            url.headers['Content-Length'] = url.body.length
        } else {
            url.headers['Content-Length'] = 0
        }
    }
    if(method=='post'){
        //注意：post的headers不能写在请求体里面，在参数对象之前或之后都可以，再添加一个对象，然后声明headers;
        var {data} =await axios.post(url.url, url.body,{headers:url.headers} );
        httpResult = data
    }else{
        //可以看到post和get有着明显的区别，headers和参数是写在同一个对象之内的。只不过在对象之内又分开成两个对象参数
        var {data} =await axios.get(url.url,url);
        httpResult = data
    }
    //  httpResult = data.data
}
function safeGet(data) {
    try {
        if (typeof JSON.parse(data) == "object") {
            return true;
        } else {
            console.log(data)
        }
    } catch (e) {
        console.log(e);
        console.log(`服务器访问数据为空，请检查自身设备网络情况`);
        return false;
    }
}

// 随机延时1-30s，避免大家运行时间一样
function delay () {
    let time = parseInt(Math.random()*100000);
    if (time > 30000) {// 大于30s重新生成
        return delay();
    } else{
        console.log('随机延时：', `${time}ms, 避免大家运行时间一样`)
        return time;// 小于30s，返回
    }
}

var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}

function MD5Encrypt(a){function b(a,b){return a<<b|a>>>32-b}function c(a,b){var c,d,e,f,g;return e=2147483648&a,f=2147483648&b,c=1073741824&a,d=1073741824&b,g=(1073741823&a)+(1073741823&b),c&d?2147483648^g^e^f:c|d?1073741824&g?3221225472^g^e^f:1073741824^g^e^f:g^e^f}function d(a,b,c){return a&b|~a&c}function e(a,b,c){return a&c|b&~c}function f(a,b,c){return a^b^c}function g(a,b,c){return b^(a|~c)}function h(a,e,f,g,h,i,j){return a=c(a,c(c(d(e,f,g),h),j)),c(b(a,i),e)}function i(a,d,f,g,h,i,j){return a=c(a,c(c(e(d,f,g),h),j)),c(b(a,i),d)}function j(a,d,e,g,h,i,j){return a=c(a,c(c(f(d,e,g),h),j)),c(b(a,i),d)}function k(a,d,e,f,h,i,j){return a=c(a,c(c(g(d,e,f),h),j)),c(b(a,i),d)}function l(a){for(var b,c=a.length,d=c+8,e=(d-d%64)/64,f=16*(e+1),g=new Array(f-1),h=0,i=0;c>i;)b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|a.charCodeAt(i)<<h,i++;return b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|128<<h,g[f-2]=c<<3,g[f-1]=c>>>29,g}function m(a){var b,c,d="",e="";for(c=0;3>=c;c++)b=a>>>8*c&255,e="0"+b.toString(16),d+=e.substr(e.length-2,2);return d}function n(a){a=a.replace(/\r\n/g,"\n");for(var b="",c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b+=String.fromCharCode(d):d>127&&2048>d?(b+=String.fromCharCode(d>>6|192),b+=String.fromCharCode(63&d|128)):(b+=String.fromCharCode(d>>12|224),b+=String.fromCharCode(d>>6&63|128),b+=String.fromCharCode(63&d|128))}return b}var o,p,q,r,s,t,u,v,w,x=[],y=7,z=12,A=17,B=22,C=5,D=9,E=14,F=20,G=4,H=11,I=16,J=23,K=6,L=10,M=15,N=21;for(a=n(a),x=l(a),t=1732584193,u=4023233417,v=2562383102,w=271733878,o=0;o<x.length;o+=16)p=t,q=u,r=v,s=w,t=h(t,u,v,w,x[o+0],y,3614090360),w=h(w,t,u,v,x[o+1],z,3905402710),v=h(v,w,t,u,x[o+2],A,606105819),u=h(u,v,w,t,x[o+3],B,3250441966),t=h(t,u,v,w,x[o+4],y,4118548399),w=h(w,t,u,v,x[o+5],z,1200080426),v=h(v,w,t,u,x[o+6],A,2821735955),u=h(u,v,w,t,x[o+7],B,4249261313),t=h(t,u,v,w,x[o+8],y,1770035416),w=h(w,t,u,v,x[o+9],z,2336552879),v=h(v,w,t,u,x[o+10],A,4294925233),u=h(u,v,w,t,x[o+11],B,2304563134),t=h(t,u,v,w,x[o+12],y,1804603682),w=h(w,t,u,v,x[o+13],z,4254626195),v=h(v,w,t,u,x[o+14],A,2792965006),u=h(u,v,w,t,x[o+15],B,1236535329),t=i(t,u,v,w,x[o+1],C,4129170786),w=i(w,t,u,v,x[o+6],D,3225465664),v=i(v,w,t,u,x[o+11],E,643717713),u=i(u,v,w,t,x[o+0],F,3921069994),t=i(t,u,v,w,x[o+5],C,3593408605),w=i(w,t,u,v,x[o+10],D,38016083),v=i(v,w,t,u,x[o+15],E,3634488961),u=i(u,v,w,t,x[o+4],F,3889429448),t=i(t,u,v,w,x[o+9],C,568446438),w=i(w,t,u,v,x[o+14],D,3275163606),v=i(v,w,t,u,x[o+3],E,4107603335),u=i(u,v,w,t,x[o+8],F,1163531501),t=i(t,u,v,w,x[o+13],C,2850285829),w=i(w,t,u,v,x[o+2],D,4243563512),v=i(v,w,t,u,x[o+7],E,1735328473),u=i(u,v,w,t,x[o+12],F,2368359562),t=j(t,u,v,w,x[o+5],G,4294588738),w=j(w,t,u,v,x[o+8],H,2272392833),v=j(v,w,t,u,x[o+11],I,1839030562),u=j(u,v,w,t,x[o+14],J,4259657740),t=j(t,u,v,w,x[o+1],G,2763975236),w=j(w,t,u,v,x[o+4],H,1272893353),v=j(v,w,t,u,x[o+7],I,4139469664),u=j(u,v,w,t,x[o+10],J,3200236656),t=j(t,u,v,w,x[o+13],G,681279174),w=j(w,t,u,v,x[o+0],H,3936430074),v=j(v,w,t,u,x[o+3],I,3572445317),u=j(u,v,w,t,x[o+6],J,76029189),t=j(t,u,v,w,x[o+9],G,3654602809),w=j(w,t,u,v,x[o+12],H,3873151461),v=j(v,w,t,u,x[o+15],I,530742520),u=j(u,v,w,t,x[o+2],J,3299628645),t=k(t,u,v,w,x[o+0],K,4096336452),w=k(w,t,u,v,x[o+7],L,1126891415),v=k(v,w,t,u,x[o+14],M,2878612391),u=k(u,v,w,t,x[o+5],N,4237533241),t=k(t,u,v,w,x[o+12],K,1700485571),w=k(w,t,u,v,x[o+3],L,2399980690),v=k(v,w,t,u,x[o+10],M,4293915773),u=k(u,v,w,t,x[o+1],N,2240044497),t=k(t,u,v,w,x[o+8],K,1873313359),w=k(w,t,u,v,x[o+15],L,4264355552),v=k(v,w,t,u,x[o+6],M,2734768916),u=k(u,v,w,t,x[o+13],N,1309151649),t=k(t,u,v,w,x[o+4],K,4149444226),w=k(w,t,u,v,x[o+11],L,3174756917),v=k(v,w,t,u,x[o+2],M,718787259),u=k(u,v,w,t,x[o+9],N,3951481745),t=c(t,p),u=c(u,q),v=c(v,r),w=c(w,s);var O=m(t)+m(u)+m(v)+m(w);return O.toLowerCase()}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),"PUT"===e&&(s=this.put),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}put(t){return this.send.call(this.env,t,"PUT")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}put(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.put(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="PUT",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.put(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));let h=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];h.push(e),s&&h.push(s),i&&h.push(i),console.log(h.join("\n")),this.logs=this.logs.concat(h)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
