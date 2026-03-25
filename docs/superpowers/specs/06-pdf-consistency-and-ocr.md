# PDF 一致性核对与 OCR

## V1 范围

仅支持：

- TOC heading 是否存在于正文
- 层级、编号、顺序、页码一致性
- 缺失、重复、跳序

## 主链路

1. 选择或上传 PDF
2. 识别是否已有文本层
3. 必要时执行 OCR
4. 抽取 TOC
5. 抽取正文 heading
6. 归一化对齐
7. 生成 issue 列表

## issue 类型

- `toc_missing_in_body`
- `body_missing_in_toc`
- `toc_level_mismatch`
- `toc_numbering_mismatch`
- `toc_order_mismatch`
- `toc_page_mismatch`
- `needs_manual_review`

## 工具策略

- 优先直接文本抽取
- 扫描 PDF：`OCRmyPDF`
- 中文复杂版面增强：`PaddleOCR`
- 学术结构增强位：`GROBID`

## 降级策略

- OCR 质量过低：`needs_manual_review`
- TOC 结构混乱：`needs_manual_review`
- 不输出伪确定性结果
