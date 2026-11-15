import { useState } from "react";
import type { TextInputProps } from "react-native";

import { Field } from "./ui";

/**
 * A text field for numbers that only reports a value when editing ends, so half-typed input like
 * "6-" isn't rejected mid-keystroke. `commit` returns false when the text can't be understood, and
 * the field then goes back to the last good value.
 */
export function CommitField({
  value,
  commit,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText" | "onEndEditing"> & {
  /** The formatted current value. */
  value: string;
  commit: (text: string) => boolean;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);

  return (
    <Field
      {...props}
      value={editing ? text : value}
      onFocus={() => {
        setText(value);
        setEditing(true);
      }}
      onChangeText={setText}
      onEndEditing={() => {
        setEditing(false);
        if (text !== value && !commit(text)) setText(value);
      }}
      selectTextOnFocus
    />
  );
}
