from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from document_pipeline.parse_docx import extract_structure_from_document_xml


def test_table_grid_cell_exposes_lossless_text_and_style_runs_for_deep_proofreading():
    document_xml = """
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:xml="http://www.w3.org/XML/1998/namespace">
      <w:body>
        <w:p><w:r><w:t>表1 医学统计符号保真测试</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc>
              <w:p>
                <w:r><w:t xml:space="preserve">12.3  ±  1.4</w:t></w:r>
              </w:p>
              <w:p>
                <w:r><w:rPr><w:i/></w:rPr><w:t>P</w:t></w:r>
                <w:r><w:t> &lt; 0.05; χ</w:t></w:r>
                <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>
                <w:r><w:t>; PaO</w:t></w:r>
                <w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>2</w:t></w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
    """

    result = extract_structure_from_document_xml(document_xml)

    cell = result["tables"][0]["semantic"]["grid_cells"][0]
    assert cell["display_text"] == "12.3  ±  1.4\nP < 0.05; χ2; PaO2"
    assert cell["normalized_text"] == "12.3±1.4 P<0.05;χ2;PaO2"
    assert "xml:space=\"preserve\">12.3  ±  1.4</" in cell["raw_xml_text"]
    assert any(run["text"] == "P" and run["italic"] is True for run in cell["style_runs"])
    assert any(
        run["text"] == "2" and run["script_position"] == "superscript"
        for run in cell["style_runs"]
    )
    assert any(
        run["text"] == "2" and run["script_position"] == "subscript"
        for run in cell["style_runs"]
    )
