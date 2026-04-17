import { useMemo, useState } from "react";

export interface SearchableMultiSelectOption {
  value: string;
  label: string;
  keywords?: readonly string[];
  meta?: string;
  group?: string;
}

export interface SearchableMultiSelectFieldProps {
  label: string;
  helpText: string;
  value: readonly string[] | "any";
  options: readonly SearchableMultiSelectOption[];
  dataKey: string;
  inputDataKey?: string;
  rootDataAttributeName?: string;
  className: string;
  headerClassName: string;
  searchFieldClassName: string;
  searchPlaceholder: string;
  optionsClassName: string;
  optionClassName: string;
  activeOptionClassName?: string;
  emptyClassName: string;
  includeAnyOption?: boolean;
  anyLabel?: string;
  emptyOptionsText?: string;
  noResultsText?: string;
  showSelectedSummary?: boolean;
  selectedOptions?: readonly SearchableMultiSelectOption[];
  selectedListClassName?: string;
  selectedChipClassName?: string;
  selectedEmptyText?: string;
  disabled?: boolean;
  onToggleValue(value: string): void;
  onSelectAny?: () => void;
}

export function SearchableMultiSelectField({
  label,
  helpText,
  value,
  options,
  dataKey,
  inputDataKey,
  rootDataAttributeName,
  className,
  headerClassName,
  searchFieldClassName,
  searchPlaceholder,
  optionsClassName,
  optionClassName,
  activeOptionClassName = "is-active",
  emptyClassName,
  includeAnyOption = false,
  anyLabel = "全部 / 任意",
  emptyOptionsText = "当前没有可选项。",
  noResultsText = "未找到匹配的选项。",
  showSelectedSummary = false,
  selectedOptions,
  selectedListClassName = "template-governance-chip-row",
  selectedChipClassName = "template-governance-chip",
  selectedEmptyText,
  disabled = false,
  onToggleValue,
  onSelectAny,
}: SearchableMultiSelectFieldProps) {
  const [searchText, setSearchText] = useState("");
  const selectedValues = value === "any" ? [] : [...value];
  const selectedValueSet = new Set(selectedValues);
  const filteredOptions = useMemo(
    () => filterSearchableMultiSelectOptions(options, searchText),
    [options, searchText],
  );
  const selectedSummaryOptions = useMemo(() => {
    if (selectedOptions) {
      return [...selectedOptions];
    }

    return selectedValues.map((selectedValue) => {
      const matchedOption = options.find((option) => option.value === selectedValue);
      return matchedOption ?? { value: selectedValue, label: selectedValue };
    });
  }, [options, selectedOptions, selectedValues]);

  const rootAttributes: Record<string, string> = {
    "data-searchable-multi-select": dataKey,
  };
  if (rootDataAttributeName) {
    rootAttributes[rootDataAttributeName] = dataKey;
  }

  return (
    <div className={className} {...rootAttributes}>
      <div className={headerClassName}>
        <span>{label}</span>
        <small>{helpText}</small>
      </div>

      {showSelectedSummary ? (
        selectedSummaryOptions.length > 0 ? (
          <div className={selectedListClassName}>
            {selectedSummaryOptions.map((option) => (
              <span key={option.value} className={selectedChipClassName}>
                {option.label}
              </span>
            ))}
          </div>
        ) : selectedEmptyText ? (
          <p className={emptyClassName}>{selectedEmptyText}</p>
        ) : null
      ) : null}

      {options.length > 0 ? (
        <label className={searchFieldClassName}>
          <span>搜索</span>
          <input
            data-searchable-multi-select-input={inputDataKey ?? dataKey}
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
          />
        </label>
      ) : null}

      {options.length === 0 ? (
        <p className={emptyClassName}>{emptyOptionsText}</p>
      ) : filteredOptions.length === 0 ? (
        <p className={emptyClassName}>{noResultsText}</p>
      ) : (
        <div className={optionsClassName}>
          {includeAnyOption ? (
            <button
              type="button"
              className={`${optionClassName}${value === "any" ? ` ${activeOptionClassName}` : ""}`}
              aria-pressed={value === "any"}
              disabled={disabled}
              onClick={() => onSelectAny?.()}
            >
              {anyLabel}
            </button>
          ) : null}
          {groupSearchableMultiSelectOptions(filteredOptions).map((group, groupIndex) =>
            group.group ? (
              <section
                key={`${group.group}-${groupIndex}`}
                className="searchable-multi-select-group"
                data-searchable-multi-select-group={group.group}
              >
                <header className="searchable-multi-select-group-header">
                  <strong>{group.group}</strong>
                </header>
                {group.options.map((option) => {
                  const isActive = selectedValueSet.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${optionClassName}${isActive ? ` ${activeOptionClassName}` : ""}`}
                      aria-pressed={isActive}
                      disabled={disabled}
                      onClick={() => onToggleValue(option.value)}
                    >
                      {option.meta ? (
                        <>
                          <strong>{option.label}</strong>
                          <small>{option.meta}</small>
                        </>
                      ) : (
                        option.label
                      )}
                    </button>
                  );
                })}
              </section>
            ) : (
              group.options.map((option) => {
                const isActive = selectedValueSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${optionClassName}${isActive ? ` ${activeOptionClassName}` : ""}`}
                    aria-pressed={isActive}
                    disabled={disabled}
                    onClick={() => onToggleValue(option.value)}
                  >
                    {option.meta ? (
                      <>
                        <strong>{option.label}</strong>
                        <small>{option.meta}</small>
                      </>
                    ) : (
                      option.label
                    )}
                  </button>
                );
              })
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function filterSearchableMultiSelectOptions(
  options: readonly SearchableMultiSelectOption[],
  searchText: string,
): SearchableMultiSelectOption[] {
  const needle = searchText.trim().toLowerCase();
  if (needle.length === 0) {
    return [...options];
  }

  return options.filter((option) => {
    const haystack = [
      option.label,
      option.value,
      option.meta ?? "",
      ...(option.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

function groupSearchableMultiSelectOptions(
  options: readonly SearchableMultiSelectOption[],
): Array<{
  group?: string;
  options: SearchableMultiSelectOption[];
}> {
  const groupedOptions = new Map<string, SearchableMultiSelectOption[]>();
  const ungroupedOptions: SearchableMultiSelectOption[] = [];

  for (const option of options) {
    if (!option.group) {
      ungroupedOptions.push(option);
      continue;
    }

    const currentGroup = groupedOptions.get(option.group) ?? [];
    currentGroup.push(option);
    groupedOptions.set(option.group, currentGroup);
  }

  return [
    ...(ungroupedOptions.length > 0 ? [{ options: ungroupedOptions }] : []),
    ...Array.from(groupedOptions.entries()).map(([group, grouped]) => ({
      group,
      options: grouped,
    })),
  ];
}
