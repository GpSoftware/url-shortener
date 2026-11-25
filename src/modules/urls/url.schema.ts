const schemas = {
  createUrl: {
    schema: {
      body: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

export default schemas;
