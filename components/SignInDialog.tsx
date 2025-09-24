"use client";

import { signIn } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SignInDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Sign In</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => signIn("google")}
            >
              Login with Google
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => signIn("email")}
            >
              Login with Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
