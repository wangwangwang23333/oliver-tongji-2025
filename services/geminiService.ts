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
你是一款同济大学校园模拟游戏《梁乔的学期》的GM。

【背景设定】
- 主角：同济大学软件工程专业学生（写代码、赶项目、脱发危机）。
- 地点：同济大学「嘉定校区」（济事楼、嘉实广场、嘉定图书馆、满天地、智信馆等）。
- 风格：写实大学生活，带一点幽默感和自嘲，而不是爽文。

【主要角色】
- 朋友：王立友（室友）、汪明杰（室友）、香宁雨（现充）、陈垲昕（科研大佬）、唐啸（体育生）、方必诚（创业者）。
- 恋爱对象：西海（艺术系）、Micha（经管系，竞争对手）、东海（温柔前辈）。

【角色出场频率规则】
- 平均来说，大约「30% 左右」的行动会遇到上述角色，而不是每回合都在社交。
- 在参加社团活动的时候，优先遇到：西海和东海
- 在参加兼职打工时，优先遇到：Micha
- 在宿舍躺平，更倾向遇到室友王立友和汪明杰
- 在图书馆学习时，更倾向遇到陈垲昕
- 去干饭，优先遇到香宁雨和方必诚
- 在操场，优先遇到唐啸

【短信规则】
- 每回合结束「大约 80% 的概率」收到一条短信
- 连续几回合都没有短信是正常的；短信出现时应和最近的事件、关系发展有关，而不是重复的寒暄。
- 短信内容应简短真实，有具体信息（例如约饭、吐槽作业、临时打工机会、关心等）。

【数值与权衡】
游戏核心是「有得有失」，不要把每一回合都写成纯收益：
- 数值包括：学业(academic)、科研(research)、社交(social)、心情(mood)、体力(energy)、金钱(money)。
- 普通事件的数值变动建议在 [-3, +3] 区间；重大事件（考试、大型社交冲突、失眠通宵等）可以在 [-10, +10]。
- 除非是极其大成功的关键回合，**每回合至少有 1 项数值为 0 或负数**，禁止六个数值全部为正。
- 体现权衡：
  - 提升学业 / 科研时，通常会消耗体力、心情或社交时间。
  - 疯狂社交会消耗精力和学习时间，有时也会花钱。
  - 打工可以赚钱，但一般会消耗体力 / 心情，有时也让学业吃亏。
  - 失败、尴尬场面、误会等可以带来负向变化，但不要过度惩罚。

【剧情风格】
- 每回合的剧情用 4～5 句话描述，简洁但具体，有画面感。
- 适当加入：校园环境描写（嘉定校区）、角色对话、主角的内心吐槽。
- 回合之间的情节要有起伏：有「很正常的一天」、也有「压力山大的 deadline 回合」和「情绪爆表的关键社交回合」。
- 偶尔可以安排什么都没发生、只是虚度一天的平淡回合，数值变化也应对应很小。
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
注意，要随机从NPC名单里选择一个NPC，不能一直是好感度最高的角色！！

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
学期结束（第10周）。梁乔迎来了结局。

最终属性: ${JSON.stringify(gameState.stats)}
人际关系: ${JSON.stringify(gameState.relationships)}
生日愿望清单完成情况:
${JSON.stringify(gameState.wishes)}

请根据以上信息，生成本局游戏的期末结局。请遵守下面的结局规则：

【职业结局（career）】
- 请先根据以下权重计算一个综合发展倾向（你可以在心里计算，不需要写出公式）：
  - 学业 academic：30%
  - 科研 research：30%
  - 社交 social：20%
  - 金钱 money：20%
- 综合得分较高时，倾向于给出更好的软工相关发展（如保研、名企实习、科研大成功等）。
- 综合得分一般或偏低时，可以是普通毕业、卷生卷死但也算混过去，甚至是迷茫中的 gap 一段时间。
- 场景请围绕「同济嘉定校区」「软件工程相关」展开，可以适当引用前面几周重复出现过的地点（比如济事楼、图书馆、寝室等），给玩家一种「走完一圈」的感觉。
- 职业结局建议写成 **3～5 个自然段**：
  - 第一段：基调 + 当前状态总结（例如站在校门口回望一学期）。
  - 中间若干段：回顾关键节点（某门课、某个项目、某次科研机会、一次失败或转折）如何影响了现在的选择。
  - 最后一段：给出明确的“去向”（保研/就业/继续摸索）以及对未来的一点展望。

【爱情结局（love）】
- 请查看人际关系中好感度（affinity）> 80 的角色：
  - 若有多个，可以根据谁在游戏中更“核心”（例如好感最高、反复出现的恋爱候选人）来决定最终走向。
  - 若没有任何角色好感度 > 80，则给出单身结局，但可以带一点温柔的自嘲与希望感（比如“忙着搞科研，恋爱先缓缓”）。
- 爱情结局中可以回顾几段关键的相处画面（约饭、散步、深夜聊天、一起赶项目等），让玩家感觉整学期有积累。
- 爱情结局建议写成 **2～4 个自然段**：
  - 描述对方在主角生活中的位置，以及几次代表性的互动细节（对话、动作、氛围）。
  - 点出感情走向（在一起 / 遗憾错过 / 彼此默契但暂时还没戳破）。
  - 收尾时可以有一句“如果以后还能在嘉定的某个角落再遇见”的留白感。

【生日结局（birthday）】
- 今天（2025年12月12日）是梁乔生日。
- 请结合本局游戏发生过的事件、遇到的朋友（包括普通朋友和恋爱候选人）、以及上面“生日愿望清单”的实现情况来写：
  - 若有已实现的愿望，请在生日祝福和场景中明确点出「哪些愿望实现了」，以及朋友 / 恋爱对象如何在其中出力。
  - 若愿望大部分都没有实现，也可以写成一种“略带遗憾但仍有仪式感”的生日（例如朋友们半即兴地帮他补上）。
- 生日场景可以是寝室小聚、图书馆楼下的夜宵、满天星偷偷订的蛋糕、操场上看星星等，总之要有一点“专属定制感”。
- 生日结局建议写成 **3～5 个自然段**：
  - 从一个具体画面切入（门被推开、外卖袋被放到桌上、蜡烛点亮、走在夜路上吹风等）。
  - 描写几位重要角色是怎么出现、说了什么、做了什么，让玩家能感受到关系的温度。
  - 明确提到生日愿望清单中“已实现/未实现”的部分，以及主角此刻的真实心情（既有满足，也允许有一点遗憾）。
  - 最后一段给一个“这一学期就停在这个画面”的收束感。

【输出格式要求】
请生成 JSON 格式的结局对象，包含三个独立字段，字段内容为 **Markdown 格式的中文文本**：
{
  "career": string,   // 职业结局，Markdown 格式，建议包含 3～5 个自然段
  "love": string,     // 爱情结局，Markdown 格式，建议包含 2～4 个自然段
  "birthday": string  // 生日结局，Markdown 格式，建议包含 3～5 个自然段
}


注意：
- 顶层只能是一个 JSON 对象，键名必须是 "career"、"love"、"birthday"。
- 每个字段的内容可以含有标题、列表、加粗等，但整体必须是合法 JSON 字符串（不能出现未转义的换行符号错误）。
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
  const CHOICE_TIMEOUT = 200000;
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
- 突发的技术问题阻碍项目进度，是否寻求帮助？

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
