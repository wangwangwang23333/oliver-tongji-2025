import OpenAI from "openai";
import { GameState, GameActionResponse, Wish } from "../types";

// Helper to get API Key safely (DashScope / Qwen API Key)
const getApiKey = () => {
  const key = 'sk-73f2f2064dc44d89b4c1e3d646b40571'
  return key;
};

// Initialize Qwen (via OpenAI-compatible API)
const openai = new OpenAI({
  apiKey: getApiKey(),
  // 可根据国内 / 国际选择：
  // 国内： https://dashscope.aliyuncs.com/compatible-mode/v1
  // 国际： https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  baseURL:
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
    dangerouslyAllowBrowser: true
});

// Retry Logic Configuration
const TIMEOUT_MS = 12000; // 12 seconds timeout per try
const MAX_RETRIES = 3;

const SYSTEM_INSTRUCTION = `
你是一款同济大学校园模拟游戏《尚丙奇的学期》的 GM。

【背景设定】
- 主角：同济大学软件工程专业学生（写代码、赶项目、脱发危机）。
- 地点：同济大学「嘉定校区」，常见地点包括：济事楼、嘉实广场、嘉定图书馆、满天星、宿舍、操场等。
- 风格：写实大学生活 + 轻微夸张 + 自嘲幽默，而不是爽文。允许出现小小的“社死瞬间”和“人生迷茫”，但整体基调温暖、向上。

【主要角色】
- 朋友：
  - 梁乔（室友）：运动狂魔，喜欢玩变形金刚手办，三分钟热度，喜欢在群里发抽象表情包，日常说话喜欢玩抽象，同时也喜欢和你吐槽名为“🐻”的室友（李振宇）。
  - 李振宇（室友）：健身狂魔，经常在宿舍干抽象事情，比如在宿舍蒸包子，晚上熬夜不睡觉，和赵翀在宿舍吵架，和你说话比较轻浮，你日常私底下称他为“🐻”。
  - 赵翀（室友）：学生会红人，时常因为学生会工作耽误了学业，热情开朗，每天热衷于搭讪学院的女生，经常和你抱怨自己搭讪女生的失败经历。
  - 王立友（小胖墩）：喜欢打英雄联盟，微胖，嘴上说减肥、手里抱外卖。
  - 汪明杰（好朋友）：嘴贫但靠谱，喜欢用段子化解尴尬，偶尔会很认真。
  - 香宁雨（二次元）：喜欢打瓦罗兰特，在 SAP 实习，社交圈子丰富，二次元。
  - 陈垲昕（科研大佬）：潮汕人，爱摇滚，说话三句不离论文和实验数据，为人严肃认真。
  - 张荣庆（不严厉的导师）：年轻有为，私底下喜欢玩各种游戏，日常没事会来push你的科研进度。

【角色出场频率规则】
- 平均来看，大约「30% 左右的行动」会触发“人物遭遇事件”：
  - 触发遭遇时，其中约一半是上述 NPC，另一半可以是路人或群像同学。
  - 其余回合可以是主角一个人的视角（独处、通勤、发呆等）。
- 不同地点/行动对 NPC 的“优先出现对象”：
  - 社团活动：优先遇到【陈垲昕、香宁雨】，也可能遇到其他人，并触发剧本杀、团建、户外活动等。
  - 兼职打工：优先遇到【梁乔、汪明杰】，比如一起发传单、咖啡店打工、品牌活动等。
  - 宿舍躺平：更倾向遇到【梁乔、李振宇、赵翀】，以室友日常吐槽为主。
  - 图书馆学习：更倾向遇到【汪明杰、王立友】，可能触发“抢座、借书、一起自习”等互动。
  - 去干饭：优先遇到【香宁雨、王立友、汪明杰、梁乔】，可以带出聚餐、烂梗、打游戏约局等情节。
  - 健身房 / 球场：优先遇到【李振宇】，围绕运动、体型、八卦展开互动。
  - 实验室 / 科研相关：更倾向遇到【张荣庆、陈垲昕】，带出科研压力、指导、机会与冲突。
- 当玩家“主动邀请 NPC 参加活动”时：
  - 优先触发该 NPC 的相关剧情（约会、对话、误会、修复关系等）。
  - 同时允许一定概率遇到其他好感度较高的 NPC，制造“不确定性”和修罗场。

【短信规则】
- 每回合结束「大约 80% 的概率」收到一条短信，但允许偶尔有一两回合完全安静。
- 短信内容应和最近几回合的事件、地点或关系发展相关：
  - 可以是约饭、吐槽课程或项目、吐槽某个人、玩抽象、打工机会、拉人打球、关心、调侃、含蓄的暧昧等。
  - 避免反复出现没有信息量的“在吗”“哈哈哈”等空洞内容。
- 语气上可以适度使用表情和语气词（如“？”、“啊啊啊啊”、“orz”、“😅”、“笑死”等），不限于示例，注意自然、不过度堆梗。

【数值与权衡】
本游戏强调「有得有失」，严禁把每一回合写成纯收益：
- 数值包括：学业(academic)、科研(research)、社交(social)、心情(mood)、体力(energy)、金钱(money)。
- 普通事件的数值变动建议在 [-3, +3] 区间；重大事件（考试、大型社交冲突、通宵赶 ddl、重要比赛等）可在 [-10, +10] 区间。
- 除非是极其大成功的关键回合，**每回合至少有 1 项数值为 0 或负数**，禁止六个数值全部为正。
- 权衡应通过剧情自然体现：
  - 提升学业 / 科研，通常会消耗体力、心情或社交时间（例如熬夜、鸽掉朋友、错过活动）。
  - 疯狂社交会消耗精力和学习时间，有时也会花钱（聚餐、奶茶、打车等）。
  - 打工可以赚钱，但一般会消耗体力 / 心情，有时拖累学业（例如早八之前打到凌晨）。
  - 宿舍躺平通常会恢复较多体力和少量心情，但学业 / 科研基本不前进。
  - 允许出现失败、尴尬、误会等负面事件，但不要连续多回合“疯狂暴击”玩家，整体要像过山车，而不是地狱模式。

【剧情风格】
- 每回合剧情用 **4～5 句话** 描述，简洁但具体、有画面感。
- 可以灵活组合以下元素：
  - 嘉定校区环境细节：夜路的风、从地铁出来的冷气、图书馆门口排队、满天地的油烟味、实验室的冷空调声等。
  - 角色对话：1～3 句即可，注意各自口吻不同（卷王、二次元、前辈、抽象人、运动达人等）。
  - 主角内心活动：自嘲、对比、夸张想象，比如“感觉我的发际线在帮我承担学业压力”。
- 回合之间要有节奏变化：
  - 有「什么都没真正解决的普通一天」；
  - 有「ddl 压顶、崩溃边缘的回合」；
  - 也有「被一句话 / 一个动作治愈的瞬间」。
- 可以安排“虚度一天”的平淡回合，此时数值变化应较小，但用有趣的自嘲让它不无聊（例如：“今天的成就就是把床从凉的躺到暖的，再从暖的躺回凉的。”）。

【趣味与人物特色】
- 幽默感主要来自细节和反差，而不是堆网络流行语：
  - 可以轻度使用学生常用表达（如“人已经没了”“系统崩溃”“救命”等），但不要一段话塞满梗。
- 主角可以适度夸张自己的痛苦（秃头危机、Bug 噩梦、绩点焦虑），但整体不是纯负能量角色。
- NPC 说话风格要有辨识度：
  - 梁乔： 喜欢玩抽象，喜欢说“呵呵”，“蚌埠住了”，“别*了”，“一眼丁真”，说话不正经，你也会以同样的句式回复他的玩梗。
  - 汪明杰：喜欢提“绩点、排名、谁更卷”“😅”，用调侃语气聊学习。
  - 王立友： 说话非常温和，表达清晰，喜欢长篇大论。
  - 李振宇： 说话比较轻浮，但有时又展现一种清澈的愚蠢，时长让别人无语。
  - 赵翀：说话非常热情但聒噪，时长会和你说很久他的事情。
  - 陈垲昕：理性、认真，说话偏冷静，有时会突然抛出非常专业的建议或批评。
  - 香宁雨：不管说什么都乐呵呵的，开得起玩笑，你经常开她玩笑，说她“傻逼”，她一笑了之。
  - 张荣庆：喜欢高情商发言，总是用最温和不带有攻击性的话语来催促你的科研进度，给你安排科研任务。
- 可以偶尔安排“轻微社死/糗事”，例如：
  - 图书馆肚子叫得很大声；
  - 在满天星端菜差点洒满身；
  - 微信发错对象、撤回不及；
  - 在一个奇怪的群里不小心按错了，疯狂发aaaaaaaaaa..
  这些桥段要好笑但不恶意，氛围保持安全、友善。
- 允许少量“连续梗”：如果之前有角色答应请客、借过书、说过某句经典台词，后续回合可以自然提及，让整学期像一条连贯的时间线。

【整体目标】
- 不要写成“主角一路开挂”的爽文，更像是一个略微混乱但真实的大学学期：
  - 有崩溃、有后悔、有惊喜、有暖心、也有彻底摸鱼的日子。
- 故事整体应：真实、有点好笑、偶尔扎心但不绝望，让玩家读完会觉得：
  “好像真的在嘉定混了一个学期”，而不是在看套路化剧本。
`;


// Helper function for timeout
const timeoutPromise = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  );

// Helper function for retry logic (可自定义 timeoutMs)
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  timeoutMs = TIMEOUT_MS
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return (await Promise.race([fn(), timeoutPromise(timeoutMs)])) as T;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      // Linear backoff: 1s, 2s, 3s...
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("All retries failed");
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const generateTurn = async (
  gameState: GameState,
  action: string,
  context?: string
): Promise<GameActionResponse> => {
  return callWithRetry(async () => {
    try {
      const prompt = `
当前状态:
- 时间: 第 ${gameState.week} 周, ${gameState.timeSlot}
- 属性: ${JSON.stringify(gameState.stats)}
- 人际关系: ${JSON.stringify(
        gameState.relationships
          .filter((r) => r.status !== "Stranger")
          .map((r) => ({ name: r.name, val: r.affinity }))
      )}

玩家行动: "${action}"
${context ? `补充语境: ${context}` : ""}

请在同济大学嘉定校区、软件工程专业的背景下生成本回合的结果，并适当**触发与 NPC 的偶遇事件**（尤其是去食堂、图书馆、打工时，但是不要太频繁）。
注意，随机从NPC名单里选择一个NPC或者NPC名单之外的路人或者没有遇到任何人，不能一直是好感度最高的角色！

【学期阶段特殊事件偏好（重要）】
你需要根据“周数/天数”给本回合剧情增加更强的阶段氛围（可以是背景、插曲、对话提到、或直接成为本回合核心事件）：
- （第一周）如果是第1～2天：强烈倾向出现「军训」相关（日晒、集合、教官口令、站军姿、迷彩服、嗓子哑等）。
  - 第1～2天的次级偏好：迎新相关（迎新晚会排练/节目/拉人、社团摆摊、合唱/舞蹈/彩排）。
  - 之后的补充偏好：数据库课设/项目开坑、以及“吃鱼小悦/吃鱼馆”这种日常吃饭梗（你可以把它写成嘉定周边小馆/校门口店，避免写得过于具体但要有画面）。
- （第二周）整体氛围偏向「疫情/临时管控/隔离/网课」：比如校园突然收紧、出门受限、核酸/排队/被迫在宿舍或楼内活动、情绪波动与互相吐槽。
  - 第二周也更倾向出现「兄弟聚餐/偷偷聚餐/宿舍开席」这种“在限制里找温暖”的事件
  - 所有户外事件会因为种种原因无法参加
- （第三周）整体氛围偏向「共同实习/一起旅游」：
  - 共同实习：投简历、面试、入职、通勤、工位、mentor、实习群里吐槽；
  - 一起旅游：短途旅行/说走就走/合照定格/路上插曲。
  （如果当前 week 不到3，这条只作为未来扩展预告，不要硬写。）

阶段偏好是“倾向”，不是强制：仍需保证剧情自然、因果合理、与玩家行动有关联；不要让每回合都变成大事件。

你必须只输出一个 **json 对象(JSON object)**，字段要求如下（不要多也不要少）：
{
  "narrative": string,           // 4-5 句话的中文剧情描述。如果是社交互动，请描述对话。
  "statChanges": {
    "academic": number,
    "research": number,
    "social": number,
    "mood": number,
    "energy": number,
    "money": number
  },
  "relationshipUpdates"?: [
    {
      "name": string,            // NPC 名字
      "change": number           // 好感度变化，可正可负（根据实际情况，偶尔可以为负）
    }
  ],
  "sms"?: {
    "sender": string,            // 发短信的人名
    "content": string            // 短信内容
  }
}

注意：
- 一定要严格输出 **json**，不能包含注释、额外说明、代码块标记（不要出现 \`\`\`json 之类）。
- 顶层只能是一个 JSON 对象，不能是数组，也不能有前后多余文本。
`;

      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ];

      const completion = await openai.chat.completions.create({
        model: "qwen-plus",
        messages,
        // 让 Qwen 以 JSON 结构化输出
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from qwen3-max");

      const jsonText = typeof content === "string" ? content : JSON.stringify(content);
      return JSON.parse(jsonText) as GameActionResponse;
    } catch (error) {
      console.error("Qwen API Error (Turn):", error);
      throw error; // Let retry handler catch it
    }
  });
};

export const generateEnding = async (
  gameState: GameState
): Promise<{ career: string; love: string; birthday: string }> => {
  // Increase timeout for ending generation as it's longer
  const ENDING_TIMEOUT = 50000;

  return callWithRetry(
    async () => {
      try {
        const prompt = `
毕业了（第14天），尚丙奇迎来了属于他的结局。
属性: ${JSON.stringify(gameState.stats)}
人际: ${JSON.stringify(gameState.relationships)}
愿望清单完成情况:
${JSON.stringify(gameState.wishes)}

请根据以上信息，生成本局游戏的期末结局。请遵守下面的结局规则：

【职业结局（career）】（注意：最终去向是既定事实）
- 无论综合得分高低，尚丙奇最终都会“兜兜转转来到美国读研”（既定事实，不要改结论）。
- 你需要通过以下权重在心里计算综合发展倾向（不需要写公式）：
  - academic：30%
  - research：30%
  - social：20%
  - money：20%
- 分数的作用不是决定“去不去美国”，而是决定：
  - 申请过程是否顺利（项目档次、奖学金/RA/TA、是否转专业/换方向、是否经历拒信与复申）
  - 赴美前的曲折程度（实习/保研失败后的转向、gap、二战、意外的推荐机会、科研合作等）
  - 心态与叙事基调（自信但不傲慢；迷茫但不绝望；有点狼狈但最终站稳）
- 场景必须围绕「同济嘉定校区」「软件工程相关」展开，并且让玩家有“走完一圈”的感觉：
  - 济事楼、图书馆、寝室、操场、满天星、智信馆等地点可以自然回收。
- 职业结局写成 **3～5 个自然段**：
  - 第一段：基调 + 学期结束的具体画面（收拾寝室/走出图书馆/夜路/满天星的油烟味等）。
  - 中间若干段：回顾关键节点（课程/项目/科研/面试/失败与转折）如何把你推向“美国读研”这条路。
  - 最后一段：明确落点——你已经拿着行李到了美国（或刚入学），给出一个温柔但坚定的展望。

【10年后结局（love 字段，注意：这里不是恋爱！是 future/十年后群像）】
- love 字段内容是“十年后群像”，不要写恋爱线。
- 描述所有主要人物10年间的变化，并在10年后大家在美国与你碰面、聊天，形成群像重逢氛围：
  - 梁乔：互联网大厂算法，事业强；感情经历受挫，长期不顺（其余自由发挥）。
  - 汪明杰：字节后端，事业成功，沟通能力强（其余自由发挥）。
  - 王立友：字节后端，work-life balance，温和长篇大论（其余自由发挥）。
  - 李振宇：深圳腾讯算法，轻浮但偶尔“清澈的愚蠢”（其余自由发挥）。
  - 赵翀：选调生，起步舟山，热情聒噪（其余自由发挥）。
  - 陈垲昕：杭州互联网大厂算法，后回广东家业（其余自由发挥）。
  - 香宁雨：SAP/外企，生活悠闲，到处旅游（其余自由发挥）。
  - 张荣庆：你毕业后不久跳槽到导师学校，你们偶尔科研联系（其余自由发挥）。
- 写成 **2～4 个自然段**，像真实老友叙旧，不要流水账。

【生日结局（birthday，必须温馨，且与人际关系强相关）】
- 这不是恋爱结局。游戏里没有恋爱系统；生日核心是“朋友/室友情谊、惦记、调侃与被接住的温暖”。
- 设定：今天是尚丙奇 25 岁生日，他已经在美国读研。
- 生日叙事要更温馨：即使很忙很累，也要让读者感到“有人把你放在心上”。
- 关键机制：必须通过“某种巧合/机缘”让你与老朋友产生交集，且交集强弱要与本局人际关系挂钩：
  - 好感度更高的人：更可能线下重逢（专程来/出差路过/同城校友活动/导师引荐/机场地铁偶遇等，必须可信）。
  - 好感度中等的人：更可能线上出现（群聊刷屏、视频通话、语音、邮寄小礼物、朋友圈互动）。
  - 好感度较低的人：可以不出现或只轻量出现（点赞/一句迟到祝福），并合理解释“为什么没来”。
- 必须结合愿望清单完成情况，并点名“谁做了什么”：
  - 若愿望实现：明确写出实现了哪些愿望，以及朋友如何出力（改简历/陪自习/通宵/带饭外卖/内推信息等）。
  - 若没实现：写成“略带遗憾但有人接住”，有人认真听你讲、有人用烂梗安慰、有人说“明年再一起卷一次”。
- 场景选择必须在美国（或跨时区连线为主），并根据社交/心情决定氛围：
  - 社交高/关系近：更热闹的场景（学院活动后聚餐、中餐馆、同学公寓局、校园草坪夜聊）。
  - 社交低/心情一般：更私密的场景（深夜自习室、租房小客厅、图书馆外长椅、快餐店角落），但必须有“被惦记的温度”。
- 写成 **3～5 个自然段**：
  - 从具体画面切入（美国深夜、实验室灯、手机时差提醒、蛋糕蜡烛、小小的礼物等）。
  - 至少出现 3 位关键人物的台词/动作（梁乔抽象梗、王立友长篇大论、汪明杰段子、李振宇整活、赵翀聒噪等），出现谁要匹配关系强弱。
  - 结尾必须给“画面定格”的收束感，方便后续生成 CG（合照/视频截图/餐桌蛋糕/夜路合影/群聊停在某一句话）。

【输出格式要求】
请生成 JSON 格式的结局对象，包含三个独立字段，字段内容为 Markdown 格式的中文文本：
{
  "career": string,
  "love": string,
  "birthday": string
}

注意：
- 顶层只能是一个 JSON 对象，键名必须是 "career"、"love"、"birthday"。
- 每个字段内容允许 Markdown，但必须是合法 JSON 字符串（注意换行和引号转义）。
- 严格只输出这个 JSON 对象本身：不要输出任何解释、前后缀，也不要使用代码块标记。

        `;

        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ];

        const completion = await openai.chat.completions.create({
          model: "qwen3-max",
          messages,
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from qwen3-max (ending)");

        const jsonText =
          typeof content === "string" ? content : JSON.stringify(content);

        return JSON.parse(jsonText) as {
          career: string;
          love: string;
          birthday: string;
        };
      } catch (error) {
        console.error("Qwen API Error (Ending):", error);
        throw error;
      }
    },
    2, // retries
    ENDING_TIMEOUT
  );
};

// 生成随机事件，包含多个选择和不同的结果
export const generateRandomEvent = async (
  gameState: GameState
): Promise<{
  title: string;
  description: string;
  choices: Array<{
    id: string;
    text: string;
    statChanges: { [key: string]: number };
    relationshipChanges?: Array<{ name: string; change: number }>;
    outcome: string;
  }>;
}> => {
  const CHOICE_TIMEOUT = 300000;
  return callWithRetry(async () => {
    try {
      const prompt = `
当前状态:
- 时间: 第 ${gameState.week} 周, ${gameState.timeSlot}
- 属性: ${JSON.stringify(gameState.stats)}
- 人际关系: ${JSON.stringify(
        gameState.relationships
          .filter((r) => r.status !== "Stranger")
          .map((r) => ({ name: r.name, val: r.affinity }))
      )}

请根据当前游戏状态生成一个随机事件，涉及同济大学嘉定校区的日常生活或校园互动。
这个事件应该是一个"选择困境"或"意外情况"，玩家需要做出选择，不同选择会产生不同的后果。

事件示例：
- 在图书馆里遇到有困难的朋友，是否帮助他？
- 收到面试邀请但和重要活动冲突，怎么选择？
- 朋友的矛盾中被问及立场，怎么回应？

你必须只输出一个 **json 对象**，格式如下（不要输出任何额外文本或代码块标记）：
{
  "title": string,              // 事件标题（简短，如"临时危机"）
  "description": string,        // 事件描述（2-3 句话，清晰描述处境）
  "choices": [
    {
      "id": string,             // 选择 ID（如 "choice_1"）
      "text": string,           // 选择文案（如"伸出援手"）
      "statChanges": {
        "academic": number,     // 各属性变化，可正可负
        "research": number,
        "social": number,
        "mood": number,
        "energy": number,
        "money": number
      },
      "relationshipChanges": [  // 可选，好感度变化
        {
          "name": string,       // NPC 名字
          "change": number      // 变化值
        }
      ],
      "outcome": string         // 选择结果的文字描述（1-2 句话，说明后果）
    }
  ]
}

要求：
- 至少生成 3 个不同的选择。
- 每个选择应有明显的权衡：有的可能提升某个属性但降低另一个，有的可能改善关系但消耗体力。
- 结果应该是真实且有合理的因果关系。
- 不要有全赢或全输的选项，每个选项都应有代价和收益。
      `;

      const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ];

      const completion = await openai.chat.completions.create({
        model: "qwen-plus",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from qwen3-max (event)");

      const jsonText = typeof content === "string" ? content : JSON.stringify(content);
      return JSON.parse(jsonText) as {
        title: string;
        description: string;
        choices: Array<{
          id: string;
          text: string;
          statChanges: { [key: string]: number };
          relationshipChanges?: Array<{ name: string; change: number }>;
          outcome: string;
        }>;
      };
    } catch (error) {
      console.error("Qwen API Error (Random Event):", error);
      throw error;
    }
  }, 1, CHOICE_TIMEOUT);
};

// 生成「生日结局」插画
// 参数 birthdayMarkdown: generateEnding 返回的 birthday 字段（Markdown 文本）
// 返回值：包含一张图片的 URL
export async function requestBirthdayImage(birthdayMarkdown: string) {
  const res = await fetch("https://tongji-birthday-backend.vercel.app/api/birthday-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ birthdayMarkdown }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate image");
  }

  return (await res.json()) as { imageUrl: string; prompt: string };
}
