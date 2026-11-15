/* global jest */
// Reanimated's native worklets runtime doesn't load in Jest. The drag list is the only user, so tests
// get a plain FlatList with the same API (dragging itself isn't unit tested).
jest.mock("react-native-reorderable-list", () => {
  const { FlatList } = require("react-native");
  const ReorderableList = ({ onReorder: _onReorder, ...props }) => {
    const React = require("react");
    return React.createElement(FlatList, props);
  };
  return { __esModule: true, default: ReorderableList, useReorderableDrag: () => () => {} };
});

// The swipe-to-delete wrapper needs Reanimated's native runtime; tests render the row on its own.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
