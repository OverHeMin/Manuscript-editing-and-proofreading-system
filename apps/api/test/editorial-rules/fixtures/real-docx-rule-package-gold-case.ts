import type {
  ExamplePairUploadInput,
  ExampleDocumentSectionSnapshot,
} from "@medical/contracts";

export function buildRealDocxGoldCase(): ExamplePairUploadInput {
  return {
    context: {
      manuscript_type: "clinical_study",
      module: "editing",
      journal_key: "journal-alpha",
    },
    original: {
      source: "original",
      parser_status: "ready",
      sections: [
        section(1, "1资料与方法", 1, 13),
        section(2, "1.1一般资料", 2, 14),
        section(3, "1.2纳入及排除标准", 2, 16),
        section(4, "1.3方法", 2, 19),
        section(5, "1.4观察指标", 2, 24),
        section(6, "1.5统计学分析", 2, 30),
        section(7, "2结果", 1, 32),
        section(8, "2.1炎症", 2, 33),
        section(9, "2.2肺功能", 2, 37),
        section(10, "2.3中医证候积分", 2, 41),
        section(11, "2.4疗效", 2, 45),
        section(12, "2.5不良反应", 2, 48),
        section(13, "3讨论", 1, 51),
        section(14, "参考文献", 1, 56),
      ],
      blocks: [
        paragraph(
          "front-author-bio",
          "front_matter",
          "author_bio",
          "第一作者：李海洋，男，1991.06.19，本科，主治医师，研究方向：儿科呼吸系统，邮箱：l762352@163.com，河南省驻马店市上蔡县上蔡重阳医院",
        ),
        paragraph(
          "front-corresponding",
          "front_matter",
          "corresponding_author",
          "通讯作者：王东勤，女，1986.05.05，本科，主治医师，研究方向：儿童重症，邮箱：1196651250@qq.com",
        ),
        paragraph(
          "front-author-line",
          "front_matter",
          "author_line",
          "李海洋，张馥荔，王东勤*",
        ),
        paragraph(
          "front-affiliation",
          "front_matter",
          "affiliation",
          "上蔡重阳医院 儿科，河南驻马店，463800",
        ),
        paragraph(
          "abstract-main",
          "abstract",
          "abstract_heading",
          "【摘要】目的：探究热毒宁注射液协同孟鲁司特钠及阿奇霉素在小儿支原体肺炎（PMPP）治疗中的疗效。方法：研究对象选择为2023年6月至2025年1月在上蔡重阳医院就诊的106例PMPP患儿，依据随机数字法将其划分为两个研究组别。其中一组作为对照组以孟鲁司特钠和阿奇霉素治疗（共53例），另一组作为观察组在对照组的基础上辅以热毒宁注射液治疗（共53例）。对比两组在中医证候积分、肺功能、治疗效果、炎症指标以及不良反应发生率等方面的差异。结果：两组治疗前肺功能、炎症指标、中医证候积分对比无差异（P＞0.05）。治疗后，观察组相较于对照组，C反应蛋白（C-reactive Protein，CRP）、乳酸脱氢酶（Lactate Dehydrogenase，LDH）、血清铁蛋白（Serum Ferritin，SF）、高热炽盛、喘憋、咳嗽中医证候积分更低；潮气量（Tidal Volume，V-T）、达峰时间比（Time to Peak Tidal Expiratory Flow/Expiratory Time，T-PTEF/t-E）、吸气中期流速与呼气中期流速比（Mid-Tidal Inspiratory Flow/Mid-Tidal Expiratory Flow，MTIF/MTEF）更高（P＜0.05）。观察组治疗有效率高于对照组（P＜0.05）。两组嗜睡、皮疹、便秘的总发生率比较无差异（P＞0.05）。结论：针对PMPP患儿，采用热毒宁注射液协同孟鲁司特钠及阿奇霉素的联合疗法，能抑制炎症反应，改善肺功能，缓解症状，疗效高，安全性好，有一定的应用价值。",
        ),
        paragraph(
          "keyword-main",
          "abstract",
          "keyword_line",
          "【关键词】小儿支原体肺炎；孟鲁司特钠；阿奇霉素；炎症；肺功能",
        ),
        heading("heading-1", "1资料与方法"),
        heading("heading-1-1", "1.1一般资料"),
        heading("heading-1-2", "1.2纳入及排除标准"),
        heading("heading-1-3", "1.3方法"),
        heading("heading-1-4", "1.4观察指标"),
        heading("heading-1-5", "1.5统计学分析"),
        paragraph(
          "numeric-methods",
          "results",
          "statistical_expression",
          "以SPSS22.0软件分析，计量资料以（x±s）表示，t检验；计数资料用（%）表示，x2检验，P＜0.05有统计学意义。",
        ),
        heading("heading-2", "2结果"),
        heading("heading-2-1", "2.1炎症"),
        paragraph(
          "numeric-results-1",
          "results",
          "statistical_expression",
          "两组治疗前炎症指标对比无差异（P＞0.05）。治疗后，观察组与对照组相比，LDH、SF、CRP更低（P＜0.05）。见表1。",
        ),
        heading("heading-2-2", "2.2肺功能"),
        paragraph(
          "numeric-results-2",
          "results",
          "statistical_expression",
          "两组治疗前肺功能对比无差异（P＞0.05）。治疗后，观察组相较于对照组， V-T、T-PTEF/t-E、MTIF/MTEF更高（P＜0.05）。见表2。",
        ),
        heading("heading-2-3", "2.3中医证候积分"),
        paragraph(
          "numeric-results-3",
          "results",
          "statistical_expression",
          "两组治疗前中医证候积分对比无差异（P＞0.05）。治疗后，观察组相较于对照组，高热炽盛、喘憋、咳嗽的中医证候积分更低（P＜0.05）。见表3。",
        ),
        heading("heading-2-4", "2.4疗效"),
        paragraph(
          "numeric-results-4",
          "results",
          "statistical_expression",
          "观察组治疗有效率较对照组更高（P＜0.05）。见表4。",
        ),
        heading("heading-2-5", "2.5不良反应"),
        paragraph(
          "numeric-results-5",
          "results",
          "statistical_expression",
          "两组嗜睡、皮疹、便秘的总发生率比较无差异（P＞0.05）。见表5。",
        ),
        heading("heading-3", "3讨论"),
        paragraph("reference-heading", "reference", "reference_heading", "参考文献"),
        paragraph(
          "reference-1",
          "reference",
          "reference_entry",
          "[1]余廷英.阿奇霉素序贯疗法治疗小儿支原体肺炎临床疗效与对小儿呼吸系统的影响分析[J].中国防痨杂志, 2024, 46(1):197-199.",
        ),
      ],
      tables: [
        table("table-1", "表1 两组炎症对比（x±s）", ["组别", "n", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：与本组治疗前比较，*P＜0.05。"], 2),
        table("table-2", "表2 两组肺功能对比（x±s）", ["组别", "n", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：与本组治疗前比较，*P＜0.05。"], 2),
        table("table-3", "表3 两组中医证候积分对比（x±s，分）", ["组别", "n", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：与本组治疗前比较，*P＜0.05。"], 2),
        table("table-4", "表4 两组疗效比较[n（%）]", ["组别", "n", "显效", "有效", "无效", "总有效率"], [], 1),
        table("table-5", "表5 两组不良反应比较[n（%）]", ["组别", "n", "嗜睡", "皮疹", "便秘", "总发生率"], [], 1),
      ],
      warnings: ["No title or heading styles were detected in the document."],
    },
    edited: {
      source: "edited",
      parser_status: "ready",
      sections: [
        section(1, "1　资料与方法", 1, 14),
        section(2, "1.1　一般资料", 2, 15),
        section(3, "1.2　纳入与排除标准", 2, 17),
        section(4, "1.2.1　纳入标准", 3, 18),
        section(5, "1.2.2　排除标准", 3, 19),
        section(6, "1.3　方法", 2, 20),
        section(7, "1.4　观察指标", 2, 25),
        section(8, "1.5　统计学方法", 2, 27),
        section(9, "2　结　果", 1, 29),
        section(10, "2.1　两组患儿治疗前后血清炎症因子水平比较", 2, 30),
        section(11, "2.2　两组患儿治疗前后肺功能比较", 2, 35),
        section(12, "2.3　两组患儿治疗前后中医证候积分比较", 2, 40),
        section(13, "2.4　两组患者临床疗效比较", 2, 44),
        section(14, "2.5　两组患儿不良反应发生情况比较", 2, 48),
        section(15, "3　讨　论", 1, 51),
        section(16, "［参考文献］", 1, 56),
      ],
      blocks: [
        paragraph(
          "front-author-bio",
          "front_matter",
          "author_bio",
          "［作者简介］　李海洋，男，主治医师，主要研究方向是儿科呼吸系统。",
        ),
        paragraph(
          "front-corresponding",
          "front_matter",
          "corresponding_author",
          "［※通信作者］　王东勤（E-mail：1196651259@qq.com）",
        ),
        paragraph(
          "front-author-line",
          "front_matter",
          "author_line",
          "李海洋　张馥荔　王东勤※",
        ),
        paragraph(
          "front-affiliation",
          "front_matter",
          "affiliation",
          "（上蔡重阳医院儿科，河南 驻马店 463800）",
        ),
        paragraph(
          "front-classification",
          "front_matter",
          "classification_line",
          "［中图分类号］　R725.6　　　　［文献标志码］　B",
        ),
        paragraph(
          "abstract-main",
          "abstract",
          "abstract_heading",
          "［摘　要］　目的：探究热毒宁注射液协同孟鲁司特钠及阿奇霉素在小儿支原体肺炎（MPP）治疗中的效果。方法：选取2023年6月至2025年1月在上蔡重阳医院就诊的106例MPP患儿作为研究对象，按照随机数字法分为对照组与观察组，各53例。对照组患儿接受孟鲁司特钠＋阿奇霉素治疗，观察组患儿在对照组的基础上辅以热毒宁注射液治疗。比较两组患儿治疗前后血清炎症因子水平、肺功能、中医证候积分、临床疗效及不良反应发生情况。结果：治疗后，观察组患儿血清铁蛋白（SF）、C反应蛋白（CRP）、乳酸脱氢酶（LDH）水平及各项中医证候积分均低于对照组，潮气量（V–T）、达峰时间比（T–PTEF/t–E）、吸气中期流速与呼气中期流速比（MTIF/MTEF）均高于对照组，上述差异均有统计学意义（P < 0.05）；观察组患儿治疗总有效率高于对照组，差异有统计学意义（P < 0.05）；两组患儿不良反应总发生率比较，差异无统计学意义（P > 0.05）。结论：针对MPP患儿，采用热毒宁注射液协同孟鲁司特钠及阿奇霉素的联合疗法，能抑制炎症反应，改善患儿肺功能，缓解临床症状，提高临床疗效，且不会增加不良反应。",
        ),
        paragraph(
          "keyword-main",
          "abstract",
          "keyword_line",
          "［关键词］　小儿支原体肺炎；孟鲁司特钠；阿奇霉素；肺功能",
        ),
        heading("heading-1", "1　资料与方法"),
        heading("heading-1-1", "1.1　一般资料"),
        heading("heading-1-2", "1.2　纳入与排除标准"),
        heading("heading-1-2-1", "1.2.1　纳入标准"),
        heading("heading-1-2-2", "1.2.2　排除标准"),
        heading("heading-1-3", "1.3　方法"),
        heading("heading-1-4", "1.4　观察指标"),
        heading("heading-1-5", "1.5　统计学方法"),
        paragraph(
          "numeric-methods",
          "results",
          "statistical_expression",
          "采用SPSS 22.0软件进行数据处理。计量资料以表示，采用t检验，计数资料用百分比表示，采用χ2检验。P＜0.05为差异具有统计学意义。",
        ),
        heading("heading-2", "2　结　果"),
        heading("heading-2-1", "2.1　两组患儿治疗前后血清炎症因子水平比较"),
        paragraph(
          "numeric-results-1",
          "results",
          "statistical_expression",
          "治疗后，两组患儿血清LDH、SF、CRP水平均低于治疗前，且观察组低于对照组，差异有统计学意义（P＜0.05），见表1。",
        ),
        heading("heading-2-2", "2.2　两组患儿治疗前后肺功能比较"),
        paragraph(
          "numeric-results-2",
          "results",
          "statistical_expression",
          "治疗后，两组患儿V–T、T–PTEF/t–E、MTIF/MTEF均高于治疗前，且观察组高于对照组，差异有统计学意义（P＜0.05），见表2。",
        ),
        heading("heading-2-3", "2.3　两组患儿治疗前后中医证候积分比较"),
        paragraph(
          "numeric-results-3",
          "results",
          "statistical_expression",
          "治疗后，两组患儿各项中医证候积分均低于治疗前，且观察组低于对照组，差异有统计学意义（P＜0.05），见表3。",
        ),
        heading("heading-2-4", "2.4　两组患者临床疗效比较"),
        paragraph(
          "numeric-results-4",
          "results",
          "statistical_expression",
          "观察组患者治疗总有效率高于对照组，差异有统计学意义（P＜0.05），见表4。",
        ),
        heading("heading-2-5", "2.5　两组患儿不良反应发生情况比较"),
        paragraph(
          "numeric-results-5",
          "results",
          "statistical_expression",
          "两组患儿不良反应总发生率比较，差异无统计学意义（P＞0.05），见表5。",
        ),
        heading("heading-3", "3　讨　论"),
        paragraph("reference-heading", "reference", "reference_heading", "［参考文献］"),
        paragraph(
          "reference-1",
          "reference",
          "reference_entry",
          "［1］ 余廷英．阿奇霉素序贯疗法治疗小儿支原体肺炎临床疗效与对小儿呼吸系统的影响分析［J］．中国防痨杂志，2024，46（S1）：197-199．",
        ),
      ],
      tables: [
        table("table-1", "表1　两组患儿治疗前后血清炎症因子水平比较（n = 53，）", ["组　别", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：CRP－C反应蛋白；LDH－乳酸脱氢酶；SF－血清铁蛋白。"], 2),
        table("table-2", "表2　两组患儿治疗前后肺功能比较（n = 53，）", ["组　别", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：V–T－潮气量；T–PTEF/t–E－达峰时间比；MTIF/MTEF－吸气中期流速与呼气中期流速比。"], 2),
        table("table-3", "表3　两组患儿治疗前后中医证候积分比较（n = 53，，分）", ["组　别", "治疗前", "治疗后", "治疗前", "治疗后", "治疗前", "治疗后"], ["注：与同组治疗前比较，eP＜0.05；与对照组治疗后比较，fP＜0.05。"], 2),
        table("table-4", "表4　两组患者临床疗效比较［n = 53，n (%)］", ["组　别", "显效", "有效", "无效", "总有效"], ["注：与对照组比较，gP＜0.05。"], 1),
        table("table-5", "表5　两组患儿不良反应发生情况比较［n = 53，n (%)］", ["组　别", "嗜睡", "皮疹", "便秘", "总发生"], [], 1),
      ],
      warnings: [],
    },
  };
}

function section(
  order: number,
  heading: string,
  level: number,
  paragraphIndex: number,
): ExampleDocumentSectionSnapshot {
  return {
    order,
    heading,
    level,
    paragraph_index: paragraphIndex,
  };
}

function heading(blockId: string, text: string) {
  return {
    block_id: blockId,
    kind: "heading" as const,
    section_key: "body",
    semantic_role: "heading",
    text,
  };
}

function paragraph(
  blockId: string,
  sectionKey: string,
  semanticRole: string,
  text: string,
) {
  return {
    block_id: blockId,
    kind: "paragraph" as const,
    section_key: sectionKey,
    semantic_role: semanticRole,
    text,
  };
}

function table(
  tableId: string,
  title: string,
  headerTexts: string[],
  footnotes: string[],
  headerDepth: number,
) {
  return {
    table_id: tableId,
    title,
    profile: {
      is_three_line_table: true,
      header_depth: headerDepth,
      has_stub_column: true,
      has_statistical_footnotes: footnotes.length > 0,
      has_unit_markers: true,
    },
    header_cells: headerTexts.map((text, index) => ({
      id: `${tableId}-header-${index + 1}`,
      text,
      row_index: 0,
      column_index: index,
      header_path: [text],
      coordinate: {
        table_id: tableId,
        target: "header_cell" as const,
        header_path: [text],
        column_key: text,
      },
    })),
    data_cells: [],
    footnote_items: footnotes.map((text, index) => ({
      id: `${tableId}-footnote-${index + 1}`,
      text,
      note_kind: "statistical_significance" as const,
      marker: index === 0 ? "*" : undefined,
      coordinate: {
        table_id: tableId,
        target: "footnote_item" as const,
        footnote_anchor: index === 0 ? "*" : undefined,
      },
    })),
  };
}
