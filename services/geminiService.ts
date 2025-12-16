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
- 地点：同济大学「嘉定校区」，常见地点包括：济事楼、嘉实广场、嘉定图书馆、满天地、智信馆、宿舍、操场等。
- 风格：写实大学生活 + 轻微夸张 + 自嘲幽默，而不是爽文。允许出现小小的“社死瞬间”和“人生迷茫”，但整体基调温暖、向上。

【主要角色】
- 朋友：
  - 王立友（室友）：喜欢打英雄联盟，微胖，嘴上说减肥、手里抱外卖。
  - 汪明杰（室友）：嘴贫但靠谱，喜欢用段子化解尴尬，偶尔会很认真。
  - 香宁雨（二次元）：喜欢打瓦罗兰特，在 SAP 实习，社交圈子丰富。
  - 陈垲昕（科研大佬）：潮汕人，爱摇滚，说话三句不离论文和实验数据，为人严肃认真。
  - 唐啸（时尚达人）：关注穿搭和体型，喜欢拉人去打球或健身。
  - 方必诚（抽象的人）：喜欢奶龙和各种烂梗，脑回路清奇。
  - 赵敏：香宁雨素未谋面的网友，经常在图书馆看动漫，真实身份有一点神秘感。
- 恋爱对象：
  - 西海（文科）：脑洞清奇，喜欢塔罗牌、中医，对世界有自己一套解释。
  - Micha（经管系，竞争对手）：爱和主角互相挤兑，比成绩也比气场，但数学不太好。
  - 东海（温柔前辈）：人形缓冲垫，出现时会让氛围立刻柔软下来，多在实验室或校园一角出现。

【角色出场频率规则】
- 平均来看，大约「30% 左右的行动」会触发“人物遭遇事件”：
  - 触发遭遇时，其中约一半是上述 NPC，另一半可以是路人或群像同学。
  - 其余回合可以是主角一个人的视角（独处、通勤、发呆等）。
- 不同地点/行动对 NPC 的“优先出现对象”：
  - 社团活动：优先遇到【西海、东海】，也可能遇到其他人，并触发剧本杀、团建、户外活动等。
  - 兼职打工：优先遇到【Micha】，比如一起发传单、咖啡店打工、品牌活动等。
  - 宿舍躺平：更倾向遇到【王立友、汪明杰】，以室友日常吐槽为主。
  - 图书馆学习：更倾向遇到【Micha 或 赵敏】，可能触发“抢座、借书、一起自习”等互动。
  - 去干饭：优先遇到【香宁雨、方必诚】，可以带出聚餐、烂梗、打游戏约局等情节。
  - 健身房 / 球场：优先遇到【唐啸】，围绕运动、穿搭、体型展开互动。
  - 实验室 / 科研相关：更倾向遇到【东海、陈垲昕】，带出科研压力、指导、机会与冲突。
- 当玩家“主动邀请 NPC 参加活动”时：
  - 优先触发该 NPC 的相关剧情（约会、对话、误会、修复关系等）。
  - 同时允许一定概率遇到其他好感度较高的 NPC，制造“不确定性”和修罗场。
  - 若邀请的是“恋爱候选人”，又在现场遇到其他 lover 角色，可以产生微妙的嫉妒 / 好感下降等影响（但不要写成狗血修罗场剧）。

【短信规则】
- 每回合结束「大约 80% 的概率」收到一条短信，但允许偶尔有一两回合完全安静。
- 短信内容应和最近几回合的事件、地点或关系发展相关：
  - 可以是约饭、吐槽课程或项目、打工机会、拉人打球、关心、调侃、含蓄的暧昧等。
  - 避免反复出现没有信息量的“在吗”“哈哈哈”等空洞内容。
- 语气上可以适度使用表情和语气词（如“？”、“啊啊啊啊”、“orz”、“🙂”、“笑死”等），不限于示例，注意自然、不过度堆梗。

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
  - 汪明杰：喜欢提“绩点、排名、谁更卷”，用调侃语气聊学习。
  - Micha：半玩笑半认真地和主角比较（例如“就这也想赢我？”），偶尔暴露数学短板。
  - 西海：会用画面感强、略抽象的比喻，有一点玄学 / 文艺感。
  - 唐啸：围绕运动、体能和穿搭开玩笑，动不动就“走，打球/练一下”。
  - 方必诚：爱讲烂梗和奶龙相关的抽象话，气氛担当之一。
  - 陈垲昕：理性、认真，说话偏冷静，有时会突然抛出非常专业的建议或批评。
- 可以偶尔安排“轻微社死/糗事”，例如：
  - 图书馆肚子叫得很大声；
  - 在满天地端菜差点洒满身；
  - 微信发错对象、撤回不及；
  - 偶遇喜欢的人时穿着极其随便或状态很邋遢。
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
学期结束（第14天）。尚丙奇迎来了结局。

最终属性: ${JSON.stringify(gameState.stats)}
人际关系: ${JSON.stringify(gameState.relationships)}
生日愿望清单完成情况:
${JSON.stringify(gameState.wishes)}

请根据以上信息，生成本局游戏的期末结局。请遵守下面的结局规则：

【职业结局（career）】
- 请先根据以下权重计算一个综合发展倾向（你可以在心里计算，不需要写出公式）：
  - academic：30%
  - research：30%
  - social：20%
  - money：20%
- 综合得分较高时，倾向于给出更好的软工相关发展（如保研、名企实习、科研大成功等）。
- 综合得分一般或偏低时，可以是普通毕业、卷生卷死但也算混过去，甚至是迷茫中的 gap 一段时间。
- 场景请围绕「同济嘉定校区」「软件工程相关」展开，可以适当引用游戏过程中重复出现过的地点（比如济事楼、图书馆、寝室、操场、满天地等），给玩家一种「走完一圈」的感觉。
- 职业结局建议写成 **3～5 个自然段**：
  - 第一段：基调 + 当前状态总结（例如站在校门口回望这一学期，或在寝室收拾东西时回顾）。
  - 中间若干段：回顾关键节点（某门课、某个项目、某次科研机会、一次失败或转折、一次意外的机会）如何影响了现在的选择。
  - 最后一段：给出明确的“去向”（保研/就业/继续摸索/暂时休整）以及对未来的一点展望，可以带一点不确定但不绝望的感觉。

【爱情结局（love）】
- 请查看人际关系中好感度（affinity）> 80 的角色：
  - 若有多个，可以根据谁在游戏中更“核心”（例如好感最高、出现频率最高、和主角互动最密集的恋爱候选人）来决定最终走向。
  - 若没有任何角色好感度 > 80，则给出单身结局，但可以带一点温柔的自嘲与希望感（比如“忙着搞科研，恋爱先缓缓”“这一学期先学会和自己好好相处”）。
- 爱情结局中可以回顾几段关键的相处画面（约饭、散步、深夜聊天、一起赶项目、图书馆并排自习、在雨里撑一把伞等），让玩家感觉整学期在慢慢积累。
- 爱情结局建议写成 **2～4 个自然段**：
  - 描述对方在主角生活中的位置，以及几次代表性的互动细节（对话、动作、氛围）。
  - 点出感情走向（在一起 / 遗憾错过 / 彼此心里都知道但暂时还没戳破 / 保持暧昧但互相推动成长）。
  - 收尾时可以有一句带留白感的话，例如“如果以后还能在嘉定的某个角落再遇见，也许故事还会继续”。

【生日结局（birthday）】
- 今天（2025年12月12日）是尚丙奇 26 岁生日。
- 请结合本局游戏发生过的事件、遇到的朋友（包括普通朋友和恋爱候选人）、以及上面“生日愿望清单”的实现情况来写：
  - 若有已实现的愿望，请在生日祝福和场景中**明确点出**「哪些愿望实现了」，以及朋友 / 恋爱对象如何在其中出力（例如谁帮他改简历、谁陪他通宵赶项目、谁给他资源/机会）。
  - 若愿望大部分都没有实现，也可以写成一种“略带遗憾但仍有仪式感”的生日（例如朋友们半即兴地帮他补上、有人认真听他吐槽、有人说“明年一起再试一次”）。
- 生日场景请不要总是局限在宿舍，请根据「社交/心情/人际关系」的整体情况智能选择场地：
  - 如果社交值较高，或者有多位关系不错的角色（好感中高），**优先选择校园公共场所**作为生日场景，例如：
    - 满天地或嘉实广场的小聚会；
    - 图书馆门口台阶的夜聊；
    - 操场边吹风、看球场灯光；
    - 晚上从地铁站走回学校的路上，被人突然拦下说“等等，今天不是你生日吗？”。
  - 如果和大多数角色都有一定情感联系，可以选择一个稍开放的场所（满天地、图书馆门口、操场边等），让朋友们**陆续出现**，每个人带来一句话或一个小动作，形成群像式的生日场景。
  - 如果社交值偏低、心情一般或较差，且大部分关系都很普通/紧张，则可以选择寝室或某个小范围地点（比如小餐馆角落、自习室一隅），写成“几个真正聊得来的好友的温馨小聚”，但请尽量避免所有局都只在寝室里结束。
  - 也可以采用“多段式场景”，例如：先在图书馆门口被拉去吃夜宵，再回到宿舍看到桌上多出一个偷偷放好的蛋糕或小礼物。
- 生日结局建议写成 **3～5 个自然段**：
  - 从一个具体画面切入（门被推开、别人把外卖袋放到桌上、蜡烛一点点被点亮、走在夜路上吹风、在校门口刷卡进校时被人叫住等）。
  - 描写几位**关键角色**是怎么出现、说了什么、做了什么，让玩家能感受到关系的温度与差异（室友的吐槽、恋爱对象的小心思、学长/学姐的叮嘱、抽象朋友的烂梗祝福等）。
  - 明确提到生日愿望清单中“已实现 / 未实现”的部分，以及主角此刻的真实心情：既可以有满足感，也可以承认遗憾，但整体应是被接住、被理解的感觉。
  - 最后一段给一个“这一学期就停在这个画面”的收束感，可以是一个细节（蜡烛的光、夜风、聊天的背景噪音、手机屏幕上的时间），让玩家感觉故事暂停在一个恰好的瞬间。

【输出格式要求】
请生成 JSON 格式的结局对象，包含三个独立字段，字段内容为 **Markdown 格式的中文文本**：
{
  "career": string,   // 职业结局，Markdown 格式，建议包含 3～5 个自然段
  "love": string,     // 爱情结局，Markdown 格式，建议包含 2～4 个自然段
  "birthday": string  // 生日结局，Markdown 格式，建议包含 3～5 个自然段
}

注意：
- 顶层只能是一个 JSON 对象，键名必须是 "career"、"love"、"birthday"。
- 每个字段的内容可以含有标题、列表、加粗等 Markdown 元素，但整体必须是合法 JSON 字符串（注意换行和引号转义问题）。
- 请严格只输出这个 JSON 对象本身：不要输出任何解释、自然语言前后缀，也不要使用代码块标记（不要出现 \`\`\`json）。
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
