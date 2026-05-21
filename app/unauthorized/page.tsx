import Link from "next/link";

export default function unauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-2">
      <h1 className="text-3xl md:text-4xl font-semibold mb-4">
        Access not allowed
      </h1>

      <p className="text-gray-500 max-w-md mb-6">
        You don’t have the required permissions to access this website. If you
        believe this is a mistake, please contact an administrator.
      </p>

      <Link
        href="/login"
        className="bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 transition"
      >
        Go to login
      </Link>
    </div>
  );
}
