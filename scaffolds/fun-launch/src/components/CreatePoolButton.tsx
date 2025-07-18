import Link from "next/link";
import { Button } from "@/components/ui/button";

type CreatePoolButtonProps = {
  href?: string;
};

export function CreatePoolButton({ href = "/create-pool" }: CreatePoolButtonProps) {
  return (
    <Link href={href}>
      <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
        Create Pool
      </Button>
    </Link>
  );
}
