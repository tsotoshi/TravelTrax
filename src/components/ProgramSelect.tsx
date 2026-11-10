"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { AIRLINE_PROGRAMS, BANK_PROGRAMS, COMMON_PROGRAMS, HOTEL_PROGRAMS, type Category } from "@/lib/types";

const OTHER = "__other__";

/**
 * Loyalty-program dropdown: the 20 most common programs (most relevant group first),
 * programs used before, and "Other" to type one in.
 */
export function ProgramSelect({
  value,
  onChange,
  programs = [],
  category,
  id,
  label = "Points program",
  placeholder = "Choose a program",
}: {
  value: string;
  onChange: (v: string) => void;
  programs?: string[];
  category?: Category;
  id?: string;
  label?: string;
  placeholder?: string;
}) {
  const yours = [...new Set(programs.map((p) => p.trim()).filter((p) => p && !COMMON_PROGRAMS.includes(p)))].sort();
  const listed = COMMON_PROGRAMS.includes(value) || yours.includes(value);
  const [typing, setTyping] = useState(value !== "" && !listed);

  const groups: [string, string[]][] = [
    ["Airlines", AIRLINE_PROGRAMS],
    ["Hotels", HOTEL_PROGRAMS],
    ["Credit cards", BANK_PROGRAMS],
  ];
  if (category === "lodging") groups.unshift(groups.splice(1, 1)[0]);
  else if (category && category !== "flights") groups.unshift(groups.splice(2, 1)[0]);
  if (yours.length) groups.unshift(["Your programs", yours]);

  return (
    <div>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="relative">
      <select
        id={id}
        aria-label={label ? undefined : "Points program"}
        className={`input appearance-none pr-10 ${value || typing ? "" : "text-zinc-400"}`}
        value={typing ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {groups.map(([name, list]) => (
          <optgroup key={name} label={name}>
            {list.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Other (type it in)</option>
      </select>
      <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-zinc-400" />
      </div>
      {typing && (
        <input
          className="input mt-2"
          placeholder="Program name"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          aria-label="Other program name"
        />
      )}
    </div>
  );
}
