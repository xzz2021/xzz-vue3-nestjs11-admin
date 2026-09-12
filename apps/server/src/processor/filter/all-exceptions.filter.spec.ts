import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function createHost(url = "/user", method = "POST") {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ headersSent: false, status }),
      getRequest: () => ({ url, method }),
    }),
  } as ArgumentsHost;
  return { host, json, status };
}

describe("AllExceptionsFilter", () => {
  it("logs with LoggerService.error(message, stack, context)", () => {
    const error = jest.fn();
    const filter = new AllExceptionsFilter({ error } as never);
    const exception = new Error("boom");
    const { host, status } = createHost();

    filter.catch(exception, host);

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("POST /user"),
      exception.stack,
      AllExceptionsFilter.name,
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it("does not log 401 responses", () => {
    const error = jest.fn();
    const filter = new AllExceptionsFilter({ error } as never);
    const { host } = createHost();

    filter.catch(
      new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(error).not.toHaveBeenCalled();
  });
});
