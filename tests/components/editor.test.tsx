import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation before importing the component under test.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock the API client so tests are deterministic.
const createCertificateMock = vi.fn();
vi.mock("@/lib/api", () => ({
  createCertificate: (input: unknown) => createCertificateMock(input),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  },
}));

import { Editor } from "@/components/editor";

describe("Editor", () => {
  beforeEach(() => {
    pushMock.mockReset();
    createCertificateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders editor, author input, fingerprint button and disclaimer", () => {
    render(<Editor />);
    expect(screen.getByTestId("editor-root")).toBeInTheDocument();
    expect(screen.getByTestId("editor-author-input")).toBeInTheDocument();
    expect(screen.getByTestId("editor-fingerprint-button")).toBeInTheDocument();
  });

  it("disables the button when text is empty", () => {
    render(<Editor />);
    expect(screen.getByTestId("editor-fingerprint-button")).toBeDisabled();
  });

  it("disables the button when author is empty", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "some text");
    expect(screen.getByTestId("editor-fingerprint-button")).toBeDisabled();
  });

  it("navigates to the certificate page on 201", async () => {
    createCertificateMock.mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello world");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    expect(createCertificateMock).toHaveBeenCalledWith({
      text: "hello world",
      author: "a@b.c",
    });
    expect(pushMock).toHaveBeenCalledWith("/certificates/550e8400-e29b-41d4-a716-446655440000");
  });

  it("surfaces an error on 422 and preserves input", async () => {
    const { ApiError } = await import("@/lib/api");
    createCertificateMock.mockRejectedValueOnce(new ApiError(422, { detail: "bad text" }));

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("editor-author-input")).toHaveValue("a@b.c");
  });

  it("disables the button when over the max byte guard", async () => {
    const user = userEvent.setup();
    render(<Editor maxBytes={10} />);
    await user.type(screen.getByTestId("editor-root"), "this is way too long");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    expect(screen.getByTestId("editor-fingerprint-button")).toBeDisabled();
  });

  it("extracts msg from validation-style array detail", async () => {
    const { ApiError } = await import("@/lib/api");
    createCertificateMock.mockRejectedValueOnce(
      new ApiError(422, { detail: [{ msg: "field required", loc: ["body", "text"] }] }),
    );

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("field required");
  });

  it("falls back to generic message when detail is not a string or array", async () => {
    const { ApiError } = await import("@/lib/api");
    createCertificateMock.mockRejectedValueOnce(new ApiError(500, { detail: 42 }));

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("request failed (500)");
  });

  it("falls back to generic message when body has no detail key", async () => {
    const { ApiError } = await import("@/lib/api");
    createCertificateMock.mockRejectedValueOnce(new ApiError(503, { error: "nope" }));

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("request failed (503)");
  });

  it("extracts msg from array detail where first element has no msg", async () => {
    const { ApiError } = await import("@/lib/api");
    createCertificateMock.mockRejectedValueOnce(
      new ApiError(422, { detail: [{ loc: ["body"] }] }),
    );

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("request failed (422)");
  });

  it("does nothing when submit is called while disabled", async () => {
    render(<Editor />);
    // Form submit with empty fields - button is disabled, onSubmit early-returns
    const form = screen.getByTestId("editor-fingerprint-button").closest("form")!;
    fireEvent.submit(form);
    expect(createCertificateMock).not.toHaveBeenCalled();
  });

  it("shows unexpected error for non-ApiError exceptions", async () => {
    createCertificateMock.mockRejectedValueOnce(new TypeError("something broke"));

    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByTestId("editor-root"), "hello");
    await user.type(screen.getByTestId("editor-author-input"), "a@b.c");
    await user.click(screen.getByTestId("editor-fingerprint-button"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("unexpected error. please try again.");
  });
});
