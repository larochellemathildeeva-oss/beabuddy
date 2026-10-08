// "Find recs": two articles, or the refusal a flow asks for (window.__articleRefuse).
export const findArticles = async () => {
  const refuse = (window as unknown as { __articleRefuse?: string }).__articleRefuse;
  if (refuse) throw new Error(refuse);
  return {
    available: true,
    articles: [
      { title: "The 25 best restaurants in Los Angeles", url: "https://example.com/la-restaurants" },
      { title: "Things to do in LA this autumn", url: "https://example.com/la-things-to-do" },
    ],
    grounding: { suggestionsHtml: null, sources: [{ title: "example.com", url: "https://example.com" }] },
  };
};
