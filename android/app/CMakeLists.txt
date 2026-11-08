cmake_minimum_required(VERSION 3.22.1)

project(marshmello_core)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
    src/main/cpp/include
)

# If building on host Linux (e.g. inside VS Code editor), find JNI headers
if(NOT ANDROID)
    find_package(JNI QUIET)
    if(JNI_FOUND)
        include_directories(${JNI_INCLUDE_DIRS})
    endif()
endif()

add_library(
    marshmello_core
    SHARED
    src/main/cpp/kalman_filter.cpp
    src/main/cpp/snatch_detector.cpp
    src/main/cpp/marshmello_jni.cpp
)

if(ANDROID)
    find_library(
        log-lib
        log
    )
    target_link_libraries(
        marshmello_core
        ${log-lib}
    )
endif()
