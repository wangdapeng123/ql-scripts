/*
    58同城我家收取金币
    20分钟运行一次
    自动添加任务后，如果时间不对，请自己修改 0 0/15 * * * ?

    [Script]
    cron "0 0/10 * * * ?" script-path=kbg_58sjb.js, tag=58同城我家收取金币, enabled=true
*/
const axios = require("axios");
const jsname = '58同城我家收取金币'
const $ = Env('58同城我家收取金币')
const logDebug = 0

const ckkey = 'wbtcCookie';

const notifyFlag = 1; //0为关闭通知，1为打开通知,默认为1
const notify = $.isNode() ? require('./sendNotify') : '';
let notifyStr = ''

let httpResult //global buffer

let userCookie = ($.isNode() ? process.env[ckkey] : $.getdata(ckkey)) || '';

let userUA = ($.isNode() ? process.env.wbtcUA : $.getdata('wbtcUA')) || 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WUBA/10.26.5';
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
    // 我的家维修或打扫
    async houseWorkList() {
        let url = `https://lovely-house.58.com/housework/get`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            if (result.result.houseworkTaskVOList.length) {
                for (let i =0 ; i < result.result.houseworkTaskVOList.length; i++) {
                    await $.wait(500);
                    await this.doHouseWorkTask(result.result.houseworkTaskVOList[i]);
                }

            } else {
                addNotifyStr(`账号[${this.index}-${this.nickName}]家里一切安好`)
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]查询我的家运行情况失败: ${result.message}`)
        }
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

    // 我的家维修或打扫
    async doHouseWorkTask(item) {
        let furnitureId = item.furnitureId;
        let url = `https://lovely-house.58.com/housework/clean`
        let body = `furnitureId=${furnitureId}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(result)
        if(result.code == 0) {
            console.log(`账号[${this.index}]${item.okMsg}`)
            if (result.result?.nextTaskList?.houseworkTaskVOList.length) {
                await $.wait(500);
                await this.doHouseWorkTask(result.result.nextTaskList.houseworkTaskVOList[0]);
            } else {
                addNotifyStr(`账号[${this.index}-${this.nickName}]已全部清理干净`)
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]维修家电或打扫失败: ${result.message}`)
        }
    }

    // 我的家收取金币
    async collectCoin() {
        let url = `https://lovely-house.58.com/fortunecat/collect`
        let body = `_d=Z2UwMHx2a25aNzZabzpaZiA3OTgyWnMjImFabnQgMVoiW1ZuW3lPcXdQZXNoLGpaNzF7ZmJadVYwOHRUNDJmNFpfa2NqazNNO29wOE5CVlREYTlHYjhTPmJxInNaZGFjYiJ2IEUtQ0QiZDpnMnlsIiAiOTZuZSBuaTdiOWFaIm1pLG8gIGxaWiIeenVCRHVTQU9GUGtMWm4iNTQiYWtuWkk2MzlVYWZmNztWPE0xMUR5VEVnMFw4O1RqOTNrRVM+V083LG8iNjk6ZSx2WkE3RUBaZDo4YgpmHiAeNjQgeFogWjkwYjcicFpwWmd0IG0jInc6b2x7cHFSbmN1ZDZabmgeMTcqZSIgIkU1J2U7YDU4X0xGNDF2Tk1yRjdYek1SRWNxaWQyM24vcndvWmoeMzRmOlppJTdELjNvOmEzNyB5Olo6MDggYyIgImIzMmMsbSJrbloyWm4yLHIgRjdPN2d1Njd3ZVllIHM6NzkKYx4gHj03U3gyZDg0Jnlueld3VjI8Q1xpTGpGTlt3WDZrTl0pey47bnI6NTE0Y25kOCtGQS97ZDA2Oh5RHiMgNjVadDRaHjc3YmBaYR5tICJaIFovWmxaamJ7UW9sY2JvZTptIHUgNlogcjpaOjYzTzI5Zzs5TkZRWG0xTUl2TEhrLWJMcU4wSVFLa2FEajMzIHYgMDk2ZyBaQzBCOUQgOjNjNiNfJXZaNVoiWlojOjc1MTZucjpvIB4idyIsbmMgQjZPUlQ2RDY1eEdEWmJaOyIeUR4iIDc2QHczPGFiRUgxd1NMcXJ6ZjVkc01TQVY7Tmg7NCRWTWU1IGZaNmJhNiAiRzctQTcLYTZiPGJze2kiNyJuIiJqIDRiMzcgaSBlWjosYx4wIG5yVnB7bV9YU3FvNG5aIm0jOFoiXyVwWjk2cWVlZjdgT0YwcFRHVkppNVtWQ2RmbGFTNFh0TFdJfXdBWmkiMjc3Y1oeQjE7NTF9NGEzOGhiWmQ2Myx1HixuWmc6ODEgbVpaIyBadTovIFp0U3VBMlVicjc/ZTIidXAvNG9pc3txIzY0dCZkZDYwRXBkO0xJWHZucTNIWVN1ZzJbTS8yUUNFaGVaI2QuaTA1WiM6QzVGN1o=|X1FnRzV4bHF1TjtSjzA_OYSIb1xubV9VXlA6XkdOe3hMYz-FRFiBN15oPVhRam5Pj1Bwi3RihnZoe05pX0ZSVU94iE56cEY6TGtpTHVmSU99P3xzUzRcXnxxTHhZcjdxX4BPTURVTmVwND01YjZeW0tofn-Fek80cGk_aHlhajtQUkN8Zm1wN2llQTVMOlBtTlJDS0RIRjc-fj9hazh_OU9Mi2NDeU9uOlhnWVN1j38=|kmzFEO9PEnKAESxbTcyokAFZweGn3LhgXOXzNRzIaC2QKmMjStAuEVq5AUhyL6fu`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
         console.log(result)
        if(result.code == 0) {
            addNotifyStr(`账号[${this.index}-${this.nickName}]收取${result.result}金币`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]维修家电或打扫失败: ${result.message}`)
        }
    }
    // 打扫奖励
    async collectCoin2() {
        let url = `https://lovely-house.58.com/housework/collect`
        let body = '_d=724cd10114af3da280a0c308310d4bbeeyZgaXFwfW5wRVpNXRYCHjsYaj8zNTQ5PEZSMFIoJCDCosK1w5TDkMOMwrbDhMK%2BwozDuMKKw5nDhcOdw5zDoMOiw77ClMOuwozCiMKEw77CgcKAw53DnsOGw4DDjsONxK3EvMS%2BxajEocS5xKzEqsSTxJ3EhcSVxIfFkMSLxJHEosW2xK3Fv8Wkxa3Eu8S%2BxZbFl8WbxZ7ErMSoxKTFnsecxqbGpMeQxrLHose0x7PHg8eFx4THhceUx6jGmsaGxpzHpsaUxpDGjMe2xoTGgMa8x4bGtMeOx5zGqMeaxorJpcm2ybvJpcm%2FybrJhMi%2ByJrJuMiKybDJrMmoyJrIjcmwyarJusm5yb7JpsiEyIDIvMmGyLTJjsmcyKjJmsiQy7TLocuwy7jLjMq2yqLLgMqCy7jLtMuwypLLqMuky6DLosqYy6rLoMqMy7bKu8q1yoTKuMuKy5bKrMuWyqTKoM2czKbMuc2QzYzNiMy6zYDMgsyIzbTMjs2FzZ3NnM2gzaLNvsyUza7MjMyIzITNvs2YzZzNns2azYPNhM2PzY7Ots6xzrnOvM6hzqTPhM%2BAz7zOhs%2B0zo7OnM%2BozprPlc6kz7HPsM6Qz7LPrs6Ez77Oo86LzovOrc6zzpnOtM670bXRotGC0ZrRiNCl0ZrRjNGl0aHRotG%2B0bHRk9Gk0J7QvdGm0aTRrtCx0LHQq9C30IXQndC40I3QgtCV0JXRntK60qbTs9OQ0rLTvdO107nTidO40orSltOs0pbTpNKe06zSmNOq0rnSudKw0oTTvtOa0rjTitKw0qzSqNOa04TUuNSy1L7Uv9Sg1KPUqtSq1JXUldSY1J3UgNWo1aTVoNWi1JjVqtWg1IzVttSo1K7Uj9SA1J3Uj9SE1KjVmtWG15zWpteU15DXjNa21q3WpNeB15TXmNew16zXqNaa16DXoteo1pTXrtam1rHWqtav1onWi9aG1rDXkteO1qTXntmc2ZjZlNiu2KHYpNi22K7YldiK2JrZsNms2ajYmtmg2aLZqNiU2a7YoNi42LnYqNiG2IvYmtiB2KzZltmC2KDaotuY25TbkNqy27Xbttu425Lbi9uB24jbrNuo26Tantqc26bbpNqQ27Latdq02rvavNuG25LasNuS2oLbi9qg3KLcqN2U3K7dpN293bXdud2T3ZDdid2B3YDdqNya3IbcnN2m3bndut2l3aPdqd2l3ZHdkN2R3ZrdgN2C3Y%2FcoN6i3qjflN6u36Tfu9%2Bz37nfjt%2B43orelt%2Bs3pbfu9%2Bk3rTekt%2B93pzekd6M3rXek96J3qXemt6%2F3onek96g34rgoazgoYfgoaXgoYPgobHgoKPgobngoZLgoYHgoZDgoY7goZjgoZzgoI3goYrgobPgoK3gobLgoKrgoJ7goLXgoaPgoLXgoLvgoJLgoJPgoILgoZvgoJ3goYzgoJXgoLLgo67go43go6ngorjgo4rgo7Dgo6rgoqrgo43gop3gopngopvgo6jgo7Dgo6Tgop7gor3go6bgorU%3D%7CToVEX3eHRHBiVT9GfTtqiXNCRG5Td3A0e02AV3o2e0BXfH04bkJLM1g9TDZfa0xpO1hDbT5CWXptXHQ3gnVsQn9dfFGDPzpHQVtwM09MimJbckM_ZYE4dkBTWz5FdlxWOHM-VF9zOVhPP4M8emFcenw-enZOZUU3QG06M1Qzh4U9bm5qQ0k6PXBtPT5PNkdyOz9wP0NHNT1BbW1oeWVGRDtdXWx0RlhJcFhNMVdXbXw%3D%7CrFKLLYuz54uI96vUVtINbOcocLsc4LUGLC2Yq0bty6uR4A7kffNNFt0mus6qszrtk4m4SGqwMWCHrW7MFQBs%2Bw%3D%3D'
         let body1 = "_d=724cd10114af3da280a0c308310d4bbeeyZgaXFwfW5wRVpNXRYCHjsYaj8zNTQ5PEZSMFIoJCDCosK1w5TDkMOMwrbDhMK+wozDuMKKw5nDhcOdw5zDoMOiw77ClMOuwozCiMKEw77CgcKAw53DnsOGw4DDjsONxK3EvMS+xajEocS5xKzEqsSTxJ3EhcSVxIfFkMSLxJHEosW2xK3Fv8Wkxa3Eu8S+xZbFl8WbxZ7ErMSoxKTFnsecxqbGpMeQxrLHose0x7PHg8eFx4THhceUx6jGmsaGxpzHpsaUxpDGjMe2xoTGgMa8x4bGtMeOx5zGqMeaxorJpcm2ybvJpcm/ybrJhMi+yJrJuMiKybDJrMmoyJrIjcmwyarJusm5yb7JpsiEyIDIvMmGyLTJjsmcyKjJmsiQy7TLocuwy7jLjMq2yqLLgMqCy7jLtMuwypLLqMuky6DLosqYy6rLoMqMy7bKu8q1yoTKuMuKy5bKrMuWyqTKoM2czKbMuc2QzYzNiMy6zYDMgsyIzbTMjs2FzZ3NnM2gzaLNvsyUza7MjMyIzITNvs2YzZzNns2azYPNhM2PzY7Ots6xzrnOvM6hzqTPhM+Az7zOhs+0zo7OnM+ozprPlc6kz7HPsM6Qz7LPrs6Ez77Oo86LzovOrc6zzpnOtM670bXRotGC0ZrRiNCl0ZrRjNGl0aHRotG+0bHRk9Gk0J7QvdGm0aTRrtCx0LHQq9C30IXQndC40I3QgtCV0JXRntK60qbTs9OQ0rLTvdO107nTidO40orSltOs0pbTpNKe06zSmNOq0rnSudKw0oTTvtOa0rjTitKw0qzSqNOa04TUuNSy1L7Uv9Sg1KPUqtSq1JXUldSY1J3UgNWo1aTVoNWi1JjVqtWg1IzVttSo1K7Uj9SA1J3Uj9SE1KjVmtWG15zWpteU15DXjNa21q3WpNeB15TXmNew16zXqNaa16DXoteo1pTXrtam1rHWqtav1onWi9aG1rDXkteO1qTXntmc2ZjZlNiu2KHYpNi22K7YldiK2JrZsNms2ajYmtmg2aLZqNiU2a7YoNi42LnYqNiG2IvYmtiB2KzZltmC2KDaotuY25TbkNqy27Xbttu425Lbi9uB24jbrNuo26Tantqc26bbpNqQ27Latdq02rvavNuG25LasNuS2oLbi9qg3KLcqN2U3K7dpN293bXdud2T3ZDdid2B3YDdqNya3IbcnN2m3bndut2l3aPdqd2l3ZHdkN2R3ZrdgN2C3Y/coN6i3qjflN6u36Tfu9+z37nfjt+43orelt+s3pbfu9+k3rTekt+93pzekd6M3rXek96J3qXemt6/3onek96g34rgoazgoYfgoaXgoYPgobHgoKPgobngoZLgoYHgoZDgoY7goZjgoZzgoI3goYrgobPgoK3gobLgoKrgoJ7goLXgoaPgoLXgoLvgoJLgoJPgoILgoZvgoJ3goYzgoJXgoLLgo67go43go6ngorjgo4rgo7Dgo6rgoqrgo43gop3gopngopvgo6jgo7Dgo6Tgop7gor3go6bgorU=|ToVEX3eHRHBiVT9GfTtqiXNCRG5Td3A0e02AV3o2e0BXfH04bkJLM1g9TDZfa0xpO1hDbT5CWXptXHQ3gnVsQn9dfFGDPzpHQVtwM09MimJbckM_ZYE4dkBTWz5FdlxWOHM-VF9zOVhPP4M8emFcenw-enZOZUU3QG06M1Qzh4U9bm5qQ0k6PXBtPT5PNkdyOz9wP0NHNT1BbW1oeWVGRDtdXWx0RlhJcFhNMVdXbXw=|rFKLLYuz54uI96vUVtINbOcocLsc4LUGLC2Yq0bty6uR4A7kffNNFt0mus6qszrtk4m4SGqwMWCHrW7MFQBs+w=="
         let body2 = `_d=724cd10114af3da280a0c308310d4bbeeyZgaXFwfW5wRVpNXRYCHjsYaj8zNTQ5PEZSMFIoJCDCosK1w5TDkMOMwrbDhMK+wozDuMKKw5nDhcOdw5zDoMOiw77ClMOuwozCiMKEw77CgcKAw53DnsOGw4DDjsONxK3EvMS+xajEocS5xKzEqsSTxJ3EhcSVxIfFkMSLxJHEosW2xK3Fv8Wkxa3Eu8S+xZbFl8WbxZ7ErMSoxKTFnsecxqbGpMeQxrLHose0x7PHg8eFx4THhceUx6jGmsaGxpzHpsaUxpDGjMe2xoTGgMa8x4bGtMeOx5zGqMeaxorJpcm2ybvJpcm/ybrJhMi+yJrJuMiKybDJrMmoyJrIjcmwyarJusm5yb7JpsiEyIDIvMmGyLTJjsmcyKjJmsiQy7TLocuwy7jLjMq2yqLLgMqCy7jLtMuwypLLqMuky6DLosqYy6rLoMqMy7bKu8q1yoTKuMuKy5bKrMuWyqTKoM2czKbMuc2QzYzNiMy6zYDMgsyIzbTMjs2FzZ3NnM2gzaLNvsyUza7MjMyIzITNvs2YzZzNns2azYPNhM2PzY7Ots6xzrnOvM6hzqTPhM+Az7zOhs+0zo7OnM+ozprPlc6kz7HPsM6Qz7LPrs6Ez77Oo86LzovOrc6zzpnOtM670bXRotGC0ZrRiNCl0ZrRjNGl0aHRotG+0bHRk9Gk0J7QvdGm0aTRrtCx0LHQq9C30IXQndC40I3QgtCV0JXRntK60qbTs9OQ0rLTvdO107nTidO40orSltOs0pbTpNKe06zSmNOq0rnSudKw0oTTvtOa0rjTitKw0qzSqNOa04TUuNSy1L7Uv9Sg1KPUqtSq1JXUldSY1J3UgNWo1aTVoNWi1JjVqtWg1IzVttSo1K7Uj9SA1J3Uj9SE1KjVmtWG15zWpteU15DXjNa21q3WpNeB15TXmNew16zXqNaa16DXoteo1pTXrtam1rHWqtav1onWi9aG1rDXkteO1qTXntmc2ZjZlNiu2KHYpNi22K7YldiK2JrZsNms2ajYmtmg2aLZqNiU2a7YoNi42LnYqNiG2IvYmtiB2KzZltmC2KDaotuY25TbkNqy27Xbttu425Lbi9uB24jbrNuo26Tantqc26bbpNqQ27Latdq02rvavNuG25LasNuS2oLbi9qg3KLcqN2U3K7dpN293bXdud2T3ZDdid2B3YDdqNya3IbcnN2m3bndut2l3aPdqd2l3ZHdkN2R3ZrdgN2C3Y/coN6i3qjflN6u36Tfu9+z37nfjt+43orelt+s3pbfu9+k3rTekt+93pzekd6M3rXek96J3qXemt6/3onek96g34rgoazgoYfgoaXgoYPgobHgoKPgobngoZLgoYHgoZDgoY7goZjgoZzgoI3goYrgobPgoK3gobLgoKrgoJ7goLXgoaPgoLXgoLvgoJLgoJPgoILgoZvgoJ3goYzgoJXgoLLgo67go43go6ngorjgo4rgo7Dgo6rgoqrgo43gop3gopngopvgo6jgo7Dgo6Tgop7gor3go6bgorU=|ToVEX3eHRHBiVT9GfTtqiXNCRG5Td3A0e02AV3o2e0BXfH04bkJLM1g9TDZfa0xpO1hDbT5CWXptXHQ3gnVsQn9dfFGDPzpHQVtwM09MimJbckM_ZYE4dkBTWz5FdlxWOHM-VF9zOVhPP4M8emFcenw-enZOZUU3QG06M1Qzh4U9bm5qQ0k6PXBtPT5PNkdyOz9wP0NHNT1BbW1oeWVGRDtdXWx0RlhJcFhNMVdXbXw=|rFKLLYuz54uI96vUVtINbOcocLsc4LUGLC2Yq0bty6uR4A7kffNNFt0mus6qszrtk4m4SGqwMWCHrW7MFQBs+w==`
         let body3="_d=efd466fbac87872953e7f17eb6669136eyZgaXFwfW5wRVpNXRYCHjsYaj8zNTQ5PEZSMFIoJCDCosK1w5TDkMOMwrbDhMK+wozDuMKKw5nDhcOdw5zDoMOiw77ClMOuwozCiMKEw77Dk8Odw5/CisKTwpDDgMKaxK3EsMS6xLzFssS5xKzErMSQxJ3EhcSVxIPEgcSIxJHFt8W1xbjFusWpxaHFqMS/xZTEgMSJxZvErMSoxKTFnsecxqbGpMeQxrLHose0x7PHg8eFx4THhceUx6jGmsaGxpzHpsaUxpDGjMe2xoTGgMa8x4bGtMeOx5zGqMeaxorJpcm2ybvJpcm/ybrJhMi+yJrJuMiKybDJrMmoyJrIjcmwyarJusm5yb7JpsiEyIDIvMmGyLTJjsmcyKjJmsiQy7TLocuwy7jLjMq2yqLLgMqCy7jLtMuwypLLqMuky6DLosqYy6rLoMqMy7bKu8q1yoTKuMuKy5bKrMuWyqTKoM2czKbMuc2QzYzNiMy6zYDMgsyIzbTMjs2FzZ3NnM2gzaLNvsyUza7MjMyIzITNvs2YzZzNnc2ezYnNg82IzYrOuc69zrrOuM6jzqHPhM+Az7zOhs+0zo7OnM+ozprPlc6kz7HPsM6Qz7LPrs6Ez77Oo86LzovOp86Iz4bOtM600bTRrNGS0Y3RnNCn0ZvRsdGm0bXRptCZ0bHRk9Gk0J7QvdGm0aTRrtCx0LHQq9C30IXQndC40I3QgtCV0JXRntK60qbTs9OQ0rLTvdO107nTidO40orSltOs0pbTpNKe06zSmNOq0rnSudKw0oTTvtOa0rjTitKw0qzSqNOa04TUuNSx1LrUtdSn1KTUrtSl1JnUltSc1J/UhdWo1aTVoNWi1JjVqtWg1IzVttSo1K7Uj9SA1J3Uj9SE1KjVmtWG15zWpteU15DXjNa21q3WpNeB15TXmNew16zXqNaa16DXoteo1pTXrtam1rHWqtav1onWi9aG1rDXkteO1qTXntmc2ZjZlNiu2KHYpNi22K7YldiK2JrZsNms2ajYmtmg2aLZqNiU2a7YoNi42LnYqNiG2IvYmtiB2KzZltmC2KDaotuY25TbkNqy27Xbttu425Lbi9uB24jbrNuo26Tantqc26bbpNqQ27Latdq02rvavNuG25LasNuS2oLbi9qg3KLcqN2U3K7dpN293bXdud2T3ZDdid2B3YDdqNya3IbcnN2m3bndut2l3aPdqt2p3ZXdkd2b3ZTdh92C3YzcoN6i3qjflN6u36Tfu9+z37nfjt+43orelt+s3pbfjN+s37Tett+93q3eg96E3o7end643oPeit+b3pLesN6a3r3gobHgoYbgoZDgoLvgobLgoZXgoYjgoKXgoYzgoJLgoYXgob3goZLgobXgoIngoIrgoKHgoKPgoKTgoKvgoITgoJvgoLrgoavgoIngoLfgoIbgoK/goJ7goYzgoJXgoIjgo6Hgo7Dgo7rgorXgo4jgo7Dgo4Dgoqrgo43go63go7Lgo6Lgo5zgo7Dgo6Tgop7gor3go6bgorU=|P31CPEZ6UnhEXDtQfzV6RnZMb05bWzg3h1JWZks9d189RFB_gmB1dDxxa1dJYFpKbkN1b0CJNl9UgUBkVi9FS05oQUVYfDNmVWJtOEZ4S4h2RltJgWc4c3hLTjJhRoWIbkFXd1NSOm1BeDdPSTBCVk5NXHptWzQ8ToFuNVpvh2JrbTpqPkFnNnI-OmRNZnRJbT1EZ0F4ZjpDbjxqcjpDQ2pRQHZBf1NdQHdaeGQzeks=|zy4IGXdHDWxsHK1EOFccfM5K5hReIpziuiQgfHLSEqcvglWCqOe89EoctuRv3E/kTSNGK3/uFnUj0IjncCBMPg=="
        let urlObject = populateUrlObject(url,this.cookie,body3)
        await httpRequest('post',urlObject)
        let result = httpResult;
        //if(!result) return
        console.log('打扫奖励--返回报文')
         console.log(result)
        // if(result.code == 0) {
        //     addNotifyStr(`账号[${this.index}-${this.nickName}]收取${result.result}金币`)
        // } else {
        //     addNotifyStr(`账号[${this.index}-${this.nickName}]维修家电或打扫失败: ${result.message}`)
        // }
    }


    // 查询我的家兑换页
    async houseWithdrawPage(flag=true) {
        let url = `https://lovely-house.58.com/web/exchange/info`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            this.inited = true;
            this.house.coin = result.result.coin
            addNotifyStr(`账号[${this.index}-${this.nickName}]我的家金币余额: ${this.house.coin}`)
            let sortList = result.result.oreList.sort(function(a,b) {return b.amount-a.amount})
            if(sortList.length>0 && sortList[0].oreStatus == 0 && this.house.coin >= sortList[0].coin) {
                await $.wait(500)
                await this.houseWithdraw(sortList[0])
            }
        } else {
            this.inited = false;
            console.log(`账号[${this.index}-${this.nickName}]查询我的家兑换页失败: ${result.message}`)
            // addNotifyStr(`账号[${this.index}-${this.nickName}]查询我的家兑换页失败: ${result.message}`)
        }
    }

    // 查询我的家金币兑换矿石
    async houseWithdraw(withItem) {
        let url = `https://lovely-house.58.com/web/exchange/ore`
        let body = `id=${withItem.id}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        //console.log(result)
        if(result.code == 0) {
            addNotifyStr(`账号[${this.index}-${this.nickName}]成功兑换${withItem.amount}矿石 ≈ ${withItem.money}元`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]兑换${withItem.amount}矿石失败: ${result.message}`)
        }
    }

    // 查询神奇矿主页
    async oreMainpage(dotask=true) {
        let url = `https://magicisland.58.com/web/mineral/main?openSettings=0`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            this.nickName = result.result.userInfo?.nickName || '';
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]查询神奇矿主页失败: ${result.message}`)
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

        // 设置了禁止推送时间段 以下时间段不做任务
        if (disableStartTime && disableEndTime) {
            const date = new Date();
            const dateTimes = date.getTime();
            const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
            const year = `${y}-${m < 10 ? '0'+m : m}-${d < 10 ? '0'+d : d}`

            const start = new Date(`${year} ${disableStartTime}`).getTime();
            const end   = new Date(`${year} ${disableEndTime}`).getTime();
            if (dateTimes > start && dateTimes<end) {
                console.log('设置了禁止推送时间段 以下时间段不做任务');
                return; 
            }
        }

        await $.wait(delay()); //  随机延时

        console.log('\n======== 检查登录状态 ========')
        // 检查登录状态
        for(let user of userList) {
            await user.checkLogin();
            await $.wait(200);
        }
        userList = userList.filter(x=>{
            return x.login
        })

        console.log('\n============ 我的家维修或打扫 ============')
        for(let user of userList) {
            await user.oreMainpage(false);
            await $.wait(200)
            await user.houseWithdrawPage(false); 
            await $.wait(200);
        }
        // 查询我的家运行情况
        for(let user of userList) {
            if (user.inited) {
                if (user.runTask != 3) {
                    // 我的家维修或打扫
                    await user.houseWorkList(); 
                    await $.wait(2000);

                    //收取金币
                    await user.collectCoin(); 
                     await $.wait(600);
                     //收取金币
                    await user.collectCoin2();
                    await $.wait(600);

                    await user.houseWithdrawPage(); 
                    await $.wait(200);
                }
            } else {
                addNotifyStr(`账号[${user.index}-${user.nickName}]没有完成装扮我家游戏引导，请先完成游戏引导。游戏路径：我的->神奇矿->装扮我的家`)
            }
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
            'User-Agent' : userUA,
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