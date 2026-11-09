const mock = require('../../utils/mock.js');

const BODY = {
    1: {
        paragraphs: [
            '银杏黄透的那一周，我们六个人分了三组，从早上七点守到傍晚五点。合川校区的秋天很短，短到如果没有刻意记录，很容易在期中作业和社团活动之间悄悄溜走。',
            '这组照片里没有摆拍。我们想做的是把"日常"留下来——图书馆台阶上吃早饭的人、下课铃响后冲向操场的队伍、傍晚六点四十分最后一缕斜光打在老教学楼的红砖上。',
        ],
        quote: '拍摄不是把好看的东西装进取景框，而是让看的人在某一秒忽然想起自己也站在那里。',
        tail: [
            '全套 46 张照片已整理进素材库「校园四季」专题集，校内师生可申请原图用于非商业宣传。',
            '下一季的主题是冬雾。如果你在清晨六点半的操场看到有人架着三脚架，那大概是我们。',
        ],
    },
    2: {
        paragraphs: [
            '开学典礼直播看起来只是三个机位的切换，但真正的工作从三天前就开始了：场地勘察、链路测试、备用电源、以及一场临时更换场地带来的全流程重排。',
            '我们把主备两条网络链路同时接到导播台，编码器做了双路推流。开播前 40 分钟，备用链路的一次抖动证明了这套冗余是必要的。',
        ],
        quote: '直播里没有"差不多"，只有"再测一遍"。',
        tail: [
            '本次直播峰值在线 1,240 人，全程无中断。技术复盘文档已归档进中心知识库，供下一届同学直接复用。',
        ],
    },
    3: {
        paragraphs: [
            '中心现有设备包括全画幅相机 4 台、稳定器 3 套、无线麦克风 6 组、补光灯 2 套，以及一套 4K 三机位直播设备。全部对校内师生开放借用。',
            '借用流程：在平台提交申请 → 说明用途与时长 → 管理员审核 → 到实训楼 B302 签字领取。单次借用一般不超过 72 小时。',
        ],
        quote: '设备归还前请清空存储卡、充满电池、擦拭镜头，这三点做到了，下次借用会更快通过。',
        tail: [
            '如遇设备损坏或丢失，请第一时间联系中心值班同学，不要自行送修。',
        ],
    },
};

Page({
    data: {
        item: null,
        paragraphs: [],
        quote: '',
        tail: [],
    },

    onLoad(query) {
        const item = mock.byId(mock.articles, query && query.id);
        if (!item) {
            wx.showToast({ title: '文章不存在', icon: 'none' });
            setTimeout(() => wx.navigateBack({ delta: 1 }), 900);
            return;
        }
        const body = BODY[item.id] || { paragraphs: [], quote: '', tail: [] };
        this.setData({
            item: item,
            paragraphs: body.paragraphs,
            quote: body.quote,
            tail: body.tail,
        });
        wx.setNavigationBarTitle({ title: item.title });
    },

    onShareAppMessage() {
        const it = this.data.item;
        return {
            title: it ? it.title : '校园融媒体中心',
            path: '/pages/article/article?id=' + (it ? it.id : ''),
        };
    },

    onShareTimeline() {
        const it = this.data.item;
        return {
            title: it ? it.title : '校园融媒体中心',
            query: 'id=' + (it ? it.id : ''),
        };
    },
});
