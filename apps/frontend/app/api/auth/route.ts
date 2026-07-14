import { NextResponse } from "next/server";
import { prisma } from '@project/db'

export async function POST(req:Request){
    try{
  const {userId,email,username,imageUrl}=await req.json();
  if(!userId || !email){
    return NextResponse.json({error:"Missing identity credentials"},
        {status:400}
    )
  } 
  const syncUser=await prisma.user.upsert({
    where:{id:userId},
    update:{username: username || undefined,
        imageUrl: imageUrl || undefined,},
    create:{
       id: userId,
        email: email,
        username: username || null,
        imageUrl: imageUrl || null,
    }
  })

  return NextResponse.json({success:true,user:syncUser},{status:200});
    }catch(error:any){
        console.error("Internal Prisma Error:", error);
    return NextResponse.json({ error: error.message || "Database execution failed" }, { status: 500 });
    }finally{
        await prisma.$disconnect();
    }
}